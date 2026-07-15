import nodemailer from "nodemailer";
import { DeliveryError, DeliveryTimeoutError } from "./errors.mjs";

const normalizeAddress = (value) => {
  const address =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.address
        : "";
  return String(address ?? "").trim().toLowerCase();
};

export const createSmtpDelivery = (
  config,
  { transportFactory = nodemailer.createTransport } = {},
) => {
  const transport = transportFactory({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    requireTLS: config.smtp.requireTLS,
    ignoreTLS: false,
    opportunisticTLS: false,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: config.smtp.connectionTimeoutMs,
    greetingTimeout: config.smtp.greetingTimeoutMs,
    socketTimeout: config.smtp.socketTimeoutMs,
    dnsTimeout: config.smtp.dnsTimeoutMs,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return Object.freeze({
    kind: "smtp",
    async send(message, { signal } = {}) {
      let abort;
      try {
        const sendPromise = transport.sendMail({
          ...message,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        const abortPromise = signal
          ? new Promise((resolve, reject) => {
              abort = () => {
                if (typeof transport.close === "function") transport.close();
                reject(new DeliveryTimeoutError());
              };
              if (signal.aborted) abort();
              else signal.addEventListener("abort", abort, { once: true });
            })
          : undefined;
        const info = abortPromise
          ? await Promise.race([sendPromise, abortPromise])
          : await sendPromise;
        const recipient = normalizeAddress(message.to);
        const accepted = new Set(
          Array.isArray(info?.accepted) ? info.accepted.map(normalizeAddress) : [],
        );
        const rejected = new Set(
          Array.isArray(info?.rejected) ? info.rejected.map(normalizeAddress) : [],
        );
        if (!recipient || !accepted.has(recipient) || rejected.has(recipient)) {
          throw new DeliveryError("smtp_not_accepted");
        }
        return { accepted: true };
      } catch (error) {
        if (error instanceof DeliveryTimeoutError) throw error;
        if (error instanceof DeliveryError) throw error;
        throw new DeliveryError("smtp_delivery_failed");
      } finally {
        if (abort) signal?.removeEventListener("abort", abort);
      }
    },
    async verify() {
      try {
        const verified = await transport.verify();
        if (!verified) throw new DeliveryError("smtp_verify_failed");
        return { verified: true };
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        throw new DeliveryError("smtp_verify_failed");
      }
    },
    async close() {
      if (typeof transport.close === "function") transport.close();
    },
  });
};
