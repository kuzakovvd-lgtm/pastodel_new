import assert from "node:assert/strict";
import { Agent, request as httpRequest } from "node:http";
import net from "node:net";
import { PassThrough } from "node:stream";
import test from "node:test";

import { readBody } from "../src/server.mjs";
import {
  cloneRequest,
  makeConfig,
  postJson,
  TEST_ORIGIN,
  withTestServer,
} from "./helpers.mjs";

const rawRequest = (port, requestText, timeoutMs = 1500) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("raw_request_timeout"));
    }, timeoutMs);
    socket.on("connect", () => {
      if (requestText) socket.write(requestText);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const requestHealth = (port, agent) =>
  new Promise((resolve, reject) => {
    const request = httpRequest(
      { host: "127.0.0.1", port, path: "/health", agent },
      (response) => {
        const localPort = response.socket.localPort;
        response.resume();
        response.on("end", () =>
          setImmediate(() =>
            resolve({
              status: response.statusCode,
              connection: response.headers.connection,
              localPort,
            }),
          ),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });

test("body reader enforces byte limits for multibyte input", async () => {
  const exact = new PassThrough();
  const exactRead = readBody(exact, 4, 200);
  exact.end(Buffer.from("éé"));
  assert.equal(await exactRead, "éé");

  const oversized = new PassThrough();
  const oversizedRead = readBody(oversized, 4, 200);
  oversized.end(Buffer.from("ééx"));
  await assert.rejects(
    oversizedRead,
    (error) => error.status === 413 && error.code === "payload_too_large",
  );
});

test("body reader handles aborts and stream errors without hanging", async () => {
  const aborted = new PassThrough();
  const abortedRead = readBody(aborted, 64, 200);
  aborted.emit("aborted");
  await assert.rejects(abortedRead, (error) => error.code === "request_aborted");

  const failed = new PassThrough();
  const failedRead = readBody(failed, 64, 200);
  failed.destroy(new Error("private stream detail"));
  await assert.rejects(failedRead, (error) => error.code === "request_error");
});

test("empty JSON body is rejected generically", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await postJson(baseUrl, null, { rawBody: "" });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "invalid_json");
  });
});

test("origin spoof variants are rejected and default HTTPS port is normalized", async () => {
  const config = makeConfig({ allowedOrigin: "https://pastodel.ru" });
  await withTestServer(
    async ({ baseUrl }) => {
      for (const origin of [
        "null",
        "https://evil.pastodel.ru",
        "https://pastodel.ru.evil.example",
        "https://pastodel.ru@evil.example",
        "http://pastodel.ru",
      ]) {
        const response = await postJson(baseUrl, cloneRequest("home-b2b"), {
          headers: { Origin: origin },
        });
        assert.equal(response.status, 403, origin);
      }
      const normalized = await postJson(baseUrl, cloneRequest("home-b2b"), {
        headers: { Origin: "https://PASTODEL.RU:443/" },
      });
      assert.equal(normalized.status, 200);
    },
    { config },
  );
});

test("duplicate Origin and Content-Type headers are rejected", async () => {
  await withTestServer(async ({ address }) => {
    const body = JSON.stringify(cloneRequest("home-b2b"));
    const common = [
      "POST /api/forms HTTP/1.1",
      `Host: 127.0.0.1:${address.port}`,
      `Content-Length: ${Buffer.byteLength(body)}`,
    ];
    const duplicateOrigin = await rawRequest(
      address.port,
      [
        ...common,
        `Origin: ${TEST_ORIGIN}`,
        "Origin: https://attacker.invalid",
        "Content-Type: application/json",
        "Connection: close",
        "",
        body,
      ].join("\r\n"),
    );
    assert.match(duplicateOrigin, /^HTTP\/1\.1 403/m);

    const duplicateMedia = await rawRequest(
      address.port,
      [
        ...common,
        `Origin: ${TEST_ORIGIN}`,
        "Content-Type: application/json",
        "Content-Type: text/plain",
        "Connection: close",
        "",
        body,
      ].join("\r\n"),
    );
    assert.match(duplicateMedia, /^HTTP\/1\.1 415/m);
  });
});

test("missing Host and excessive header count are rejected", async () => {
  const config = makeConfig({ maxHeadersCount: 10 });
  await withTestServer(
    async ({ address }) => {
      const missingHost = await rawRequest(
        address.port,
        "GET /health HTTP/1.1\r\nConnection: close\r\n\r\n",
      );
      assert.match(missingHost, /^HTTP\/1\.1 400/m);

      const headers = [
        "GET /health HTTP/1.1",
        `Host: 127.0.0.1:${address.port}`,
        ...Array.from({ length: 11 }, (_, index) => `X-Test-${index}: value`),
        "Connection: close",
        "",
        "",
      ].join("\r\n");
      const excessive = await rawRequest(address.port, headers);
      assert.match(excessive, /^HTTP\/1\.1 431/m);
    },
    { config },
  );
});

test("incomplete headers and idle sockets are bounded", async () => {
  const config = makeConfig({
    headersTimeoutMs: 100,
    requestTimeoutMs: 300,
    keepAliveTimeoutMs: 100,
  });
  await withTestServer(
    async ({ address }) => {
      const incomplete = await rawRequest(
        address.port,
        `POST /api/forms HTTP/1.1\r\nHost: 127.0.0.1:${address.port}\r\n`,
      );
      assert.match(incomplete, /^HTTP\/1\.1 408/m);

      const idle = await rawRequest(address.port, "");
      assert.match(idle, /^HTTP\/1\.1 408/m);
    },
    { config },
  );
});

test("keep-alive sockets close at the configured request count", async () => {
  const config = makeConfig({
    keepAliveTimeoutMs: 5000,
    maxRequestsPerSocket: 2,
  });
  await withTestServer(
    async ({ address, server }) => {
      const agent = new Agent({ keepAlive: true, maxSockets: 1 });
      try {
        const first = await requestHealth(address.port, agent);
        const second = await requestHealth(address.port, agent);
        const third = await requestHealth(address.port, agent);
        assert.equal(server.maxRequestsPerSocket, 2);
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(second.connection, "close");
        assert.equal(third.status, 200);
        assert.notEqual(third.localPort, first.localPort);
      } finally {
        agent.destroy();
      }
    },
    { config },
  );
});

test("normal requests retain all API security headers", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await postJson(baseUrl, cloneRequest("contacts"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  });
});
