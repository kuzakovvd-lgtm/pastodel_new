import { once } from "node:events";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import { createFormsServer } from "../src/server.mjs";

export const APPROVED_RECIPIENT = "a.goryachkina@muchmilk.ru";
export const TEST_ORIGIN = "http://forms.test";

export const baseEnv = (overrides = {}) => ({
  NODE_ENV: "test",
  PASTODEL_FORMS_HOST: "127.0.0.1",
  PASTODEL_FORMS_PORT: "8787",
  PASTODEL_ALLOWED_ORIGIN: TEST_ORIGIN,
  PASTODEL_FORMS_DELIVERY: "mock",
  PASTODEL_FORMS_TO: APPROVED_RECIPIENT,
  PASTODEL_FORMS_FROM: "pastodel@example.invalid",
  PASTODEL_FORMS_REPLY_TO_ENABLED: "true",
  PASTODEL_SMTP_HOST: "",
  PASTODEL_SMTP_PORT: "587",
  PASTODEL_SMTP_SECURE: "false",
  PASTODEL_SMTP_REQUIRE_TLS: "true",
  PASTODEL_SMTP_USER: "",
  PASTODEL_SMTP_PASS: "",
  PASTODEL_SMTP_CONNECTION_TIMEOUT_MS: "10000",
  PASTODEL_SMTP_GREETING_TIMEOUT_MS: "10000",
  PASTODEL_SMTP_SOCKET_TIMEOUT_MS: "15000",
  PASTODEL_SMTP_DNS_TIMEOUT_MS: "5000",
  PASTODEL_FORMS_BODY_LIMIT_BYTES: "32768",
  PASTODEL_FORMS_HEADERS_TIMEOUT_MS: "10000",
  PASTODEL_FORMS_REQUEST_TIMEOUT_MS: "15000",
  PASTODEL_FORMS_KEEP_ALIVE_TIMEOUT_MS: "5000",
  PASTODEL_FORMS_MAX_HEADERS_COUNT: "40",
  PASTODEL_FORMS_MAX_REQUESTS_PER_SOCKET: "20",
  PASTODEL_FORMS_MAX_IN_FLIGHT: "5",
  PASTODEL_FORMS_SHUTDOWN_TIMEOUT_MS: "15000",
  PASTODEL_FORMS_LOG_LEVEL: "info",
  ...overrides,
});

export const makeConfig = (overrides = {}) => ({
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  allowedOrigin: TEST_ORIGIN,
  delivery: "mock",
  recipient: APPROVED_RECIPIENT,
  from: "pastodel@example.invalid",
  replyToEnabled: true,
  bodyLimitBytes: 32768,
  headersTimeoutMs: 500,
  requestTimeoutMs: 1000,
  keepAliveTimeoutMs: 200,
  maxHeadersCount: 40,
  maxRequestsPerSocket: 20,
  maxInFlight: 5,
  shutdownTimeoutMs: 500,
  logLevel: "error",
  smtp: {
    host: "smtp.example.invalid",
    port: 587,
    secure: false,
    requireTLS: true,
    user: "smtp-user",
    pass: "test-only-value",
    connectionTimeoutMs: 1000,
    greetingTimeoutMs: 1000,
    socketTimeoutMs: 1000,
    dnsTimeoutMs: 1000,
  },
  ...overrides,
});

export const silentLogger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

export const validRequests = Object.freeze({
  "home-b2b": {
    form: "home-b2b",
    payload: {
      name: "Тестовый Пользователь",
      company: "Тестовая компания",
      email: "home@example.invalid",
      phone: "+7 (000) 000-00-00",
      privacy: "on",
      company_site: "",
    },
  },
  "partneram-b2b": {
    form: "partneram-b2b",
    payload: {
      company: "Тестовая сеть",
      store_count: "25",
      city: "Тестовый город",
      email: "retail+test@example.invalid",
      phone: "+7 (000) 000-00-00",
      request_type: "Запрос условий",
      product: "karbonara",
      privacy: "on",
      company_site: "",
    },
  },
  "horeca-request": {
    form: "horeca-request",
    payload: {
      name: "Тестовый Пользователь",
      company: "Тестовое заведение",
      venue_type: "Кафе",
      city: "Тестовый город",
      phone: "+7 (000) 000-00-00",
      email: "horeca@example.invalid",
      product_interest: "Карбонара\nРизотто",
      request_type: "Заказать дегустацию",
      privacy: "on",
      company_site: "",
    },
  },
  "partner-gateway": {
    form: "partner-gateway",
    payload: {
      business_type: "Ритейл",
      name: "Тестовый Пользователь",
      phone: "+7 (000) 000-00-00",
      email: "gateway@example.invalid",
      retail_company: "Тестовая сеть",
      retail_store_count: "12",
      retail_city: "Тестовый город",
      horeca_company: "",
      horeca_venue_type: "",
      horeca_city: "",
      distributor_company: "",
      distributor_region: "",
      distributor_interest: "",
      request_type: "Получить условия",
      privacy: "on",
      company_site: "",
    },
  },
  contacts: {
    form: "contacts",
    payload: {
      name: "Тестовый Пользователь",
      company: "Тестовая компания",
      topic: "Общий вопрос",
      phone: "+7 (000) 000-00-00",
      email: "contact@example.invalid",
      message: "Тестовое обращение.",
      privacy: "on",
      company_site: "",
    },
  },
});

export const cloneRequest = (formId) => structuredClone(validRequests[formId]);

export const withTestServer = async (
  callback,
  {
    config = makeConfig(),
    delivery = createMockDelivery(),
    logger = silentLogger,
    requestGate,
    createRequestId,
    now,
  } = {},
) => {
  const server = createFormsServer({
    config,
    delivery,
    logger,
    requestGate,
    createRequestId,
    now,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback({ server, delivery, baseUrl, address });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await delivery.close?.();
  }
};

export const postJson = (baseUrl, body, options = {}) =>
  fetch(`${baseUrl}/api/forms`, {
    method: "POST",
    headers: {
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.rawBody ?? JSON.stringify(body),
  });
