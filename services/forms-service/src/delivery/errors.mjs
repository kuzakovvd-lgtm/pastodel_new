export class DeliveryError extends Error {
  constructor(code = "delivery_failed") {
    super(code);
    this.name = "DeliveryError";
    this.code = code;
  }
}

export class DeliveryTimeoutError extends DeliveryError {
  constructor() {
    super("delivery_timeout");
    this.name = "DeliveryTimeoutError";
  }
}
