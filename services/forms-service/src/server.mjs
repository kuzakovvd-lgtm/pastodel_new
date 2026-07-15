import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.mjs";
import { FORM_CONTRACTS } from "./contracts.mjs";
import { createDelivery } from "./delivery/index.mjs";
import { DeliveryError, DeliveryTimeoutError } from "./delivery/errors.mjs";
import { createLogger } from "./logging.mjs";
import { errorBody, sendJson, successBody } from "./response.mjs";
import { buildMailMessage } from "./subjects.mjs";
import { validateSubmission } from "./validate.mjs";

export class HttpFailure extends Error {
  constructor(status, code, headers = {}) {
    super(code);
    this.name = "HttpFailure";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const readBody = (request, limitBytes, timeoutMs) =>
  new Promise((resolve, reject) => {
    const buffer = Buffer.allocUnsafe(limitBytes);
    let size = 0;
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("aborted", onAborted);
      request.off("error", onError);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (size + bytes.length > limitBytes) {
        request.pause();
        fail(new HttpFailure(413, "payload_too_large", { Connection: "close" }));
        return;
      }
      bytes.copy(buffer, size);
      size += bytes.length;
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(buffer.subarray(0, size).toString("utf8"));
    };
    const onAborted = () => fail(new HttpFailure(400, "request_aborted"));
    const onError = () => fail(new HttpFailure(400, "request_error"));
    const timer = setTimeout(
      () => fail(new HttpFailure(408, "request_timeout")),
      timeoutMs,
    );

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("aborted", onAborted);
    request.on("error", onError);
  });

const deliverWithTimeout = async (delivery, message, timeoutMs, controller) => {
  let timer;
  let onAbort;
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(new DeliveryTimeoutError());
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await Promise.race([
      delivery.send(message, { signal: controller.signal }),
      aborted,
    ]);
    if (!result?.accepted) throw new DeliveryError("delivery_not_accepted");
    return result;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  }
};

const getHeaderValues = (request, expectedName) => {
  const values = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === expectedName) {
      values.push(request.rawHeaders[index + 1]);
    }
  }
  return values;
};

const contentTypeIsJson = (value) => {
  const parts = String(value ?? "")
    .split(";")
    .map((part) => part.trim().toLowerCase());
  if (parts[0] !== "application/json") return false;
  if (parts.length === 1) return true;
  return parts.length === 2 && /^charset\s*=\s*utf-8$/u.test(parts[1]);
};

const originIsAllowed = (value, allowedOrigin) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return false;
  }
  return parsed.origin === allowedOrigin;
};

export const createFormsServer = ({
  config,
  delivery,
  logger = createLogger({ level: config.logLevel }),
  createRequestId = randomUUID,
  now = () => new Date(),
  nowMs = () => Date.now(),
  requestGate = () => ({ allowed: true }),
}) => {
  let inFlightDeliveries = 0;
  const activeDeliveryControllers = new Set();

  const handleRequest = async (request, response) => {
    const requestId = createRequestId();
    const startedAt = nowMs();
    const durationMs = () => Math.max(0, nowMs() - startedAt);
    const logResult = (level, event, fields) =>
      logger[level](event, { requestId, durationMs: durationMs(), ...fields });

    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.rawHeaders.length / 2 > config.maxHeadersCount) {
        sendJson(
          response,
          431,
          errorBody("request_headers_too_large", requestId),
          { Connection: "close" },
        );
        logResult("warn", "request_rejected", {
          status: 431,
          outcome: "headers_rejected",
          reasonCode: "header_count_limit",
        });
        return;
      }

      if (request.httpVersionMajor === 1 && request.httpVersionMinor >= 1) {
        const hosts = getHeaderValues(request, "host");
        if (hosts.length !== 1 || !hosts[0].trim()) {
          sendJson(response, 400, errorBody("invalid_request", requestId), {
            Connection: "close",
          });
          logResult("warn", "request_rejected", {
            status: 400,
            outcome: "rejected",
            reasonCode: "invalid_host_header",
          });
          return;
        }
      }

      if (url.pathname === "/health") {
        if (request.method !== "GET") {
          sendJson(response, 405, errorBody("method_not_allowed", requestId), {
            Allow: "GET",
          });
          logResult("warn", "request_rejected", {
            status: 405,
            outcome: "method_not_allowed",
            reasonCode: "health_get_only",
          });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          service: "pastodel-forms",
        });
        logResult("info", "health_check", { status: 200, outcome: "healthy" });
        return;
      }

      if (url.pathname !== "/api/forms") {
        sendJson(response, 404, errorBody("not_found", requestId));
        logResult("warn", "request_rejected", {
          status: 404,
          outcome: "not_found",
          reasonCode: "unknown_route",
        });
        return;
      }

      if (request.method !== "POST") {
        sendJson(response, 405, errorBody("method_not_allowed", requestId), {
          Allow: "POST",
        });
        logResult("warn", "request_rejected", {
          status: 405,
          outcome: "method_not_allowed",
          reasonCode: "forms_post_only",
        });
        return;
      }

      const origins = getHeaderValues(request, "origin");
      if (
        origins.length !== 1 ||
        !originIsAllowed(origins[0], config.allowedOrigin)
      ) {
        sendJson(response, 403, errorBody("origin_not_allowed", requestId));
        logResult("warn", "request_rejected", {
          status: 403,
          outcome: "origin_rejected",
          reasonCode: "origin_mismatch",
        });
        return;
      }

      const contentTypes = getHeaderValues(request, "content-type");
      if (
        contentTypes.length !== 1 ||
        !contentTypeIsJson(contentTypes[0])
      ) {
        sendJson(response, 415, errorBody("unsupported_media_type", requestId));
        logResult("warn", "request_rejected", {
          status: 415,
          outcome: "unsupported_media_type",
          reasonCode: "json_required",
        });
        return;
      }

      const contentLengths = getHeaderValues(request, "content-length");
      if (contentLengths.length > 1) {
        throw new HttpFailure(400, "invalid_content_length", {
          Connection: "close",
        });
      }
      const contentLengthRaw = contentLengths[0] ?? "0";
      if (!/^\d+$/u.test(contentLengthRaw)) {
        throw new HttpFailure(400, "invalid_content_length", {
          Connection: "close",
        });
      }
      const contentLength = Number(contentLengthRaw);
      if (contentLength > config.bodyLimitBytes) {
        sendJson(response, 413, errorBody("payload_too_large", requestId), {
          Connection: "close",
        });
        logResult("warn", "request_rejected", {
          status: 413,
          outcome: "payload_too_large",
          reasonCode: "content_length_limit",
        });
        return;
      }

      const gate = await requestGate(request);
      if (!gate?.allowed) {
        sendJson(response, 429, errorBody("rate_limited", requestId), {
          "Retry-After": String(gate?.retryAfterSeconds ?? 60),
        });
        logResult("warn", "request_rejected", {
          status: 429,
          outcome: "rate_limited",
          reasonCode: "request_gate",
        });
        return;
      }

      const rawBody = await readBody(
        request,
        config.bodyLimitBytes,
        config.requestTimeoutMs,
      );
      let input;
      try {
        input = JSON.parse(rawBody);
      } catch {
        throw new HttpFailure(400, "invalid_json");
      }

      const validation = validateSubmission(input);
      if (!validation.ok) {
        sendJson(response, 422, errorBody("validation_error", requestId));
        logResult("warn", "validation_failed", {
          status: 422,
          outcome: "rejected",
          reasonCode: validation.code,
        });
        return;
      }

      if (validation.spam) {
        sendJson(response, 200, successBody(requestId));
        logResult("info", "submission_handled", {
          formId: validation.formId,
          status: 200,
          outcome: "spam_suppressed",
          reasonCode: "honeypot",
        });
        return;
      }

      if (inFlightDeliveries >= config.maxInFlight) {
        sendJson(
          response,
          503,
          errorBody("temporarily_unavailable", requestId),
        );
        logResult("warn", "delivery_capacity_reached", {
          formId: validation.formId,
          status: 503,
          outcome: "delivery_rejected",
          reasonCode: "max_in_flight",
        });
        return;
      }

      const message = buildMailMessage({
        formId: validation.formId,
        payload: validation.payload,
        requestId,
        recipient: config.recipient,
        from: config.from,
        replyToEnabled: config.replyToEnabled,
        now,
      });

      const deliveryController = new AbortController();
      inFlightDeliveries += 1;
      activeDeliveryControllers.add(deliveryController);
      try {
        await deliverWithTimeout(
          delivery,
          message,
          Math.max(1, config.requestTimeoutMs - durationMs()),
          deliveryController,
        );
      } finally {
        activeDeliveryControllers.delete(deliveryController);
        inFlightDeliveries -= 1;
      }
      sendJson(response, 200, successBody(requestId));
      logResult("info", "submission_handled", {
        formId: validation.formId,
        status: 200,
        outcome: "accepted",
        reasonCode: "delivery_accepted",
      });
    } catch (error) {
      if (error instanceof HttpFailure) {
        sendJson(
          response,
          error.status,
          errorBody(error.code, requestId),
          error.headers,
        );
        logResult("warn", "request_rejected", {
          status: error.status,
          outcome: "rejected",
          reasonCode: error.code,
        });
        return;
      }
      if (error instanceof DeliveryError) {
        sendJson(
          response,
          503,
          errorBody("temporarily_unavailable", requestId),
        );
        logResult("error", "delivery_failed", {
          status: 503,
          outcome: "delivery_failed",
          reasonCode: error.code,
        });
        return;
      }
      sendJson(response, 500, errorBody("internal_error", requestId));
      logResult("error", "internal_error", {
        status: 500,
        outcome: "internal_error",
        reasonCode: "unhandled_error",
      });
    }
  };

  const server = createServer(
    {
      headersTimeout: config.headersTimeoutMs,
      requestTimeout: config.requestTimeoutMs,
      keepAliveTimeout: config.keepAliveTimeoutMs,
      connectionsCheckingInterval: Math.max(
        50,
        Math.min(config.headersTimeoutMs, config.requestTimeoutMs, 1000),
      ),
      insecureHTTPParser: false,
      joinDuplicateHeaders: false,
      requireHostHeader: true,
    },
    handleRequest,
  );

  server.headersTimeout = config.headersTimeoutMs;
  server.requestTimeout = config.requestTimeoutMs;
  server.keepAliveTimeout = config.keepAliveTimeoutMs;
  server.maxHeadersCount = config.maxHeadersCount;
  server.maxRequestsPerSocket = config.maxRequestsPerSocket;
  server.timeout = config.requestTimeoutMs + config.keepAliveTimeoutMs;
  Object.defineProperties(server, {
    abortInFlightDeliveries: {
      value: () => {
        for (const controller of activeDeliveryControllers) controller.abort();
      },
    },
    getInFlightDeliveryCount: {
      value: () => inFlightDeliveries,
    },
  });
  return server;
};

export const startFormsService = async ({
  config = loadConfig(),
  delivery = createDelivery(config),
  logger = createLogger({ level: config.logLevel }),
} = {}) => {
  const server = createFormsServer({ config, delivery, logger });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  logger.info("service_started", { outcome: "ready" });

  let closePromise;
  const forceClose = () => {
    server.abortInFlightDeliveries?.();
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  };
  const close = ({ force = false } = {}) => {
    if (!closePromise) {
      closePromise = (async () => {
        let shutdownTimer;
        const serverClosed = new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeIdleConnections?.();
        });
        const graceful = await Promise.race([
          serverClosed.then(() => true),
          new Promise((resolve) => {
            shutdownTimer = setTimeout(
              () => resolve(false),
              config.shutdownTimeoutMs,
            );
          }),
        ]);
        clearTimeout(shutdownTimer);
        if (!graceful) {
          forceClose();
          await serverClosed;
        }
        await delivery.close?.();
        logger.info("service_stopped", {
          outcome: "stopped",
          reasonCode: graceful ? "graceful_shutdown" : "forced_shutdown",
        });
      })();
    }
    if (force) forceClose();
    return closePromise;
  };
  return { server, delivery, close };
};

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  let service;
  try {
    service = await startFormsService();
  } catch (error) {
    const reasonCode = String(error?.code ?? "startup_failed")
      .replace(/[\r\n\0-\x1f\x7f]+/g, "_")
      .slice(0, 120);
    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "service_start_failed",
        reasonCode,
      })}\n`,
    );
    process.exitCode = 1;
  }

  if (service) {
    let signalCount = 0;
    const stop = async () => {
      signalCount += 1;
      const force = signalCount > 1;
      try {
        await service.close({ force });
        process.exitCode = force ? 1 : 0;
      } catch {
        process.exitCode = 1;
      }
    };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  }
}

export { FORM_CONTRACTS };
