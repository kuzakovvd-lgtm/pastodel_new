import { createMockDelivery } from "./mock.mjs";
import { createSmtpDelivery } from "./smtp.mjs";

export const createDelivery = (config) => {
  if (config.delivery === "mock") return createMockDelivery();
  if (config.delivery === "smtp") return createSmtpDelivery(config);
  throw new Error("unsupported_delivery_adapter");
};
