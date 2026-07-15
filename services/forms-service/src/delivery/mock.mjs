import { DeliveryError, DeliveryTimeoutError } from "./errors.mjs";

const wait = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DeliveryTimeoutError());
      return;
    }
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DeliveryTimeoutError());
    };
    signal?.addEventListener("abort", abort, { once: true });
  });

export const createMockDelivery = ({ mode = "success", delayMs = 0 } = {}) => {
  const deliveries = [];
  let currentMode = mode;

  return Object.freeze({
    kind: "mock",
    async send(message, { signal } = {}) {
      if (currentMode === "timeout") {
        await new Promise((resolve, reject) => {
          if (signal?.aborted) {
            reject(new DeliveryTimeoutError());
            return;
          }
          signal?.addEventListener(
            "abort",
            () => reject(new DeliveryTimeoutError()),
            { once: true },
          );
        });
      }
      if (delayMs > 0) await wait(delayMs, signal);
      if (currentMode === "failure") throw new DeliveryError();
      if (signal?.aborted) throw new DeliveryTimeoutError();
      deliveries.push(structuredClone(message));
      return { accepted: true };
    },
    getDeliveries() {
      return structuredClone(deliveries);
    },
    clear() {
      deliveries.length = 0;
    },
    setMode(nextMode) {
      if (!new Set(["success", "failure", "timeout"]).has(nextMode)) {
        throw new Error("invalid_mock_mode");
      }
      currentMode = nextMode;
    },
    async close() {},
  });
};
