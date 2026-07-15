import assert from "node:assert/strict";
import test from "node:test";

import { ConfigError, loadConfig } from "../src/config.mjs";
import { APPROVED_RECIPIENT, baseEnv } from "./helpers.mjs";

test("loads explicit mock test configuration", () => {
  const config = loadConfig(baseEnv());
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 8787);
  assert.equal(config.delivery, "mock");
  assert.equal(config.recipient, APPROVED_RECIPIENT);
  assert.equal(config.allowedOrigin, "http://forms.test");
  assert.equal(config.headersTimeoutMs, 10000);
  assert.equal(config.requestTimeoutMs, 15000);
  assert.equal(config.maxInFlight, 5);
});

const invalidCases = [
  ["recipient is required", { PASTODEL_FORMS_TO: "" }, "missing_pastodel_forms_to"],
  ["origin is required", { PASTODEL_ALLOWED_ORIGIN: "" }, "missing_pastodel_allowed_origin"],
  ["port must be valid", { PASTODEL_FORMS_PORT: "70000" }, "invalid_pastodel_forms_port"],
  ["host stays loopback", { PASTODEL_FORMS_HOST: "0.0.0.0" }, "invalid_pastodel_forms_host"],
  ["body limit must be valid", { PASTODEL_FORMS_BODY_LIMIT_BYTES: "12" }, "invalid_pastodel_forms_body_limit_bytes"],
  ["timeout must be valid", { PASTODEL_FORMS_REQUEST_TIMEOUT_MS: "0" }, "invalid_pastodel_forms_request_timeout_ms"],
  ["origin may not contain a path", { PASTODEL_ALLOWED_ORIGIN: "https://pastodel.ru/path" }, "invalid_pastodel_allowed_origin"],
  ["delivery mode is allowlisted", { PASTODEL_FORMS_DELIVERY: "other" }, "invalid_pastodel_forms_delivery"],
  ["NODE_ENV is required", { NODE_ENV: "" }, "missing_node_env"],
  ["NODE_ENV is allowlisted", { NODE_ENV: "preview" }, "invalid_node_env"],
  ["header timeout is bounded", { PASTODEL_FORMS_HEADERS_TIMEOUT_MS: "0" }, "invalid_pastodel_forms_headers_timeout_ms"],
  ["keep-alive timeout is bounded", { PASTODEL_FORMS_KEEP_ALIVE_TIMEOUT_MS: "0" }, "invalid_pastodel_forms_keep_alive_timeout_ms"],
  ["header count is bounded", { PASTODEL_FORMS_MAX_HEADERS_COUNT: "2" }, "invalid_pastodel_forms_max_headers_count"],
  ["socket request count is bounded", { PASTODEL_FORMS_MAX_REQUESTS_PER_SOCKET: "0" }, "invalid_pastodel_forms_max_requests_per_socket"],
  ["in-flight limit is bounded", { PASTODEL_FORMS_MAX_IN_FLIGHT: "0" }, "invalid_pastodel_forms_max_in_flight"],
  ["shutdown timeout is bounded", { PASTODEL_FORMS_SHUTDOWN_TIMEOUT_MS: "0" }, "invalid_pastodel_forms_shutdown_timeout_ms"],
  ["headers cannot outlive request timeout", { PASTODEL_FORMS_HEADERS_TIMEOUT_MS: "16000" }, "invalid_http_timeout_relationship"],
];

for (const [name, overrides, code] of invalidCases) {
  test(name, () => {
    assert.throws(
      () => loadConfig(baseEnv(overrides)),
      (error) => error instanceof ConfigError && error.code === code,
    );
  });
}

test("mock delivery is forbidden in production", () => {
  assert.throws(
    () =>
      loadConfig(
        baseEnv({
          NODE_ENV: "production",
          PASTODEL_ALLOWED_ORIGIN: "https://pastodel.ru",
        }),
      ),
    (error) =>
      error instanceof ConfigError &&
      error.code === "mock_delivery_forbidden_in_production",
  );
});

test("development and test mock are explicit while production requires delivery", () => {
  const development = loadConfig(
    baseEnv({
      NODE_ENV: "development",
      PASTODEL_ALLOWED_ORIGIN: "https://pastodel.ru",
    }),
  );
  assert.equal(development.delivery, "mock");
  assert.equal(loadConfig(baseEnv()).delivery, "mock");
  assert.throws(
    () =>
      loadConfig(
        baseEnv({
          NODE_ENV: "production",
          PASTODEL_ALLOWED_ORIGIN: "https://pastodel.ru",
          PASTODEL_FORMS_DELIVERY: "",
        }),
      ),
    (error) =>
      error instanceof ConfigError &&
      error.code === "missing_pastodel_forms_delivery",
  );
});

test("SMTP mode fails closed when required configuration is missing", () => {
  assert.throws(
    () =>
      loadConfig(
        baseEnv({
          PASTODEL_FORMS_DELIVERY: "smtp",
          PASTODEL_FORMS_FROM: "",
        }),
      ),
    (error) =>
      error instanceof ConfigError && error.code === "missing_pastodel_forms_from",
  );
});

test("SMTP mode accepts complete non-production configuration", () => {
  const config = loadConfig(
    baseEnv({
      PASTODEL_FORMS_DELIVERY: "smtp",
      PASTODEL_FORMS_FROM: "forms@example.invalid",
      PASTODEL_SMTP_HOST: "smtp.example.invalid",
      PASTODEL_SMTP_USER: "test-user",
      PASTODEL_SMTP_PASS: "test-only-value",
    }),
  );
  assert.equal(config.delivery, "smtp");
  assert.equal(config.smtp.secure, false);
  assert.equal(config.smtp.requireTLS, true);
  assert.equal(config.smtp.dnsTimeoutMs, 5000);
});

test("SMTP port and TLS modes fail closed", () => {
  const smtp = {
    PASTODEL_FORMS_DELIVERY: "smtp",
    PASTODEL_FORMS_FROM: "forms@example.invalid",
    PASTODEL_SMTP_HOST: "smtp.example.invalid",
    PASTODEL_SMTP_USER: "test-user",
    PASTODEL_SMTP_PASS: "test-only-value",
  };
  for (const overrides of [
    { PASTODEL_SMTP_PORT: "587", PASTODEL_SMTP_REQUIRE_TLS: "false" },
    { PASTODEL_SMTP_PORT: "465", PASTODEL_SMTP_SECURE: "false" },
    { PASTODEL_SMTP_PORT: "2525" },
  ]) {
    assert.throws(
      () => loadConfig(baseEnv({ ...smtp, ...overrides })),
      (error) =>
        error instanceof ConfigError &&
        error.code === "invalid_smtp_security_policy",
    );
  }

  const implicit = loadConfig(
    baseEnv({
      ...smtp,
      PASTODEL_SMTP_PORT: "465",
      PASTODEL_SMTP_SECURE: "true",
      PASTODEL_SMTP_REQUIRE_TLS: "false",
    }),
  );
  assert.equal(implicit.smtp.secure, true);
  assert.equal(implicit.smtp.requireTLS, false);
});

test("SMTP host and credential controls are rejected", () => {
  const smtp = {
    PASTODEL_FORMS_DELIVERY: "smtp",
    PASTODEL_FORMS_FROM: "forms@example.invalid",
    PASTODEL_SMTP_HOST: "smtp.example.invalid",
    PASTODEL_SMTP_USER: "test-user",
    PASTODEL_SMTP_PASS: "test-only-value",
  };
  assert.throws(
    () => loadConfig(baseEnv({ ...smtp, PASTODEL_SMTP_HOST: "bad host" })),
    (error) =>
      error instanceof ConfigError && error.code === "invalid_pastodel_smtp_host",
  );
  assert.throws(
    () => loadConfig(baseEnv({ ...smtp, PASTODEL_SMTP_PASS: "bad\nsecret" })),
    (error) =>
      error instanceof ConfigError && error.code === "invalid_pastodel_smtp_pass",
  );
  assert.throws(
    () =>
      loadConfig(
        baseEnv({
          ...smtp,
          PASTODEL_FORMS_FROM: "forms@example.invalid\r\nBcc: x@example.invalid",
        }),
      ),
    (error) =>
      error instanceof ConfigError &&
      error.code === "invalid_pastodel_forms_from",
  );
});
