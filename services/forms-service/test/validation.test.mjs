import assert from "node:assert/strict";
import test from "node:test";

import { validateSubmission } from "../src/validate.mjs";
import { cloneRequest, validRequests } from "./helpers.mjs";

for (const formId of Object.keys(validRequests)) {
  test(`accepts representative ${formId} payload`, () => {
    const result = validateSubmission(cloneRequest(formId));
    assert.equal(result.ok, true);
    assert.equal(result.spam, false);
    assert.equal(result.formId, formId);
  });
}

test("rejects unknown form IDs without reflecting them", () => {
  const result = validateSubmission({ form: "unknown", payload: {} });
  assert.deepEqual(result, { ok: false, code: "unknown_form" });
});

test("rejects unexpected top-level and payload fields", () => {
  const top = { ...cloneRequest("home-b2b"), context: {} };
  assert.equal(validateSubmission(top).code, "unexpected_top_level_field");
  const payload = cloneRequest("home-b2b");
  payload.payload.extra = "value";
  assert.equal(validateSubmission(payload).code, "unexpected_payload_field");
});

test("rejects non-string payload values", () => {
  const input = cloneRequest("home-b2b");
  input.payload.name = { value: "test" };
  assert.equal(validateSubmission(input).code, "invalid_field_type");
});

test("rejects arrays, nested values and prototype-pollution keys", () => {
  assert.equal(
    validateSubmission({ form: "home-b2b", payload: [] }).code,
    "invalid_payload",
  );
  const nested = cloneRequest("home-b2b");
  nested.payload.name = ["nested"];
  assert.equal(validateSubmission(nested).code, "invalid_field_type");
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const parsed = JSON.parse(
      `{"form":"home-b2b","payload":{"${key}":"pollute"}}`,
    );
    assert.equal(validateSubmission(parsed).code, "unexpected_payload_field");
  }
  assert.equal({}.pollute, undefined);
});

test("requires current required fields and consent", () => {
  const missing = cloneRequest("contacts");
  delete missing.payload.message;
  assert.equal(validateSubmission(missing).code, "required_field");
  const consent = cloneRequest("contacts");
  delete consent.payload.privacy;
  assert.equal(validateSubmission(consent).code, "consent_required");
});

test("accepts Cyrillic, Unicode and plus-addressed email", () => {
  const input = cloneRequest("contacts");
  input.payload.name = "Анна Ёлкина";
  input.payload.message = "Вопрос о позиции № 1 — спасибо.";
  input.payload.email = "user+forms@EXAMPLE.invalid";
  const result = validateSubmission(input);
  assert.equal(result.ok, true);
  assert.equal(result.payload.email, "user+forms@example.invalid");
});

test("normalizes Unicode to NFC and rejects invisible directional controls", () => {
  const normalized = cloneRequest("contacts");
  normalized.payload.name = "И\u0306ван";
  const result = validateSubmission(normalized);
  assert.equal(result.ok, true);
  assert.equal(result.payload.name, "Йван");

  for (const value of [
    "Скрытый\u200bтекст",
    "Подмена\u202eтекста",
    "Изоляция\u2066текста\u2069",
  ]) {
    const input = cloneRequest("contacts");
    input.payload.message = value;
    assert.equal(validateSubmission(input).code, "control_character");
  }
});

test("normalizes CRLF in multiline text and preserves plain text markup", () => {
  const input = cloneRequest("contacts");
  input.payload.message = "Строка 1\r\n<strong>Строка 2</strong>";
  const result = validateSubmission(input);
  assert.equal(result.ok, true);
  assert.equal(result.payload.message, "Строка 1\n<strong>Строка 2</strong>");
});

test("rejects header injection and control characters in single-line fields", () => {
  const injection = cloneRequest("home-b2b");
  injection.payload.company = "Компания\r\nBcc: hidden@example.invalid";
  assert.equal(validateSubmission(injection).code, "line_break_not_allowed");
  const control = cloneRequest("contacts");
  control.payload.message = "Текст\u0000данные";
  assert.equal(validateSubmission(control).code, "control_character");

  for (const separator of ["\u0085", "\u2028", "\u2029"]) {
    const unicodeBreak = cloneRequest("home-b2b");
    unicodeBreak.payload.company = `Компания${separator}Bcc: hidden@example.invalid`;
    assert.equal(
      validateSubmission(unicodeBreak).code,
      "line_break_not_allowed",
    );
  }
});

test("rejects whitespace-only required values", () => {
  const input = cloneRequest("contacts");
  input.payload.message = " \r\n ";
  assert.equal(validateSubmission(input).code, "required_field");
});

test("JSON duplicate keys follow documented last-value parser behavior", () => {
  const input = JSON.parse(
    '{"form":"unknown","form":"contacts","payload":{}}',
  );
  assert.equal(input.form, "contacts");
  assert.equal(validateSubmission(input).code, "required_field");
});

test("uses a broad but bounded phone syntax", () => {
  const valid = cloneRequest("contacts");
  valid.payload.phone = "+44 (20) 7946-0958";
  assert.equal(validateSubmission(valid).ok, true);
  const invalid = cloneRequest("contacts");
  invalid.payload.phone = "call-me-please";
  assert.equal(validateSubmission(invalid).code, "invalid_phone_characters");
});

test("enforces select, product and length allowlists", () => {
  const select = cloneRequest("contacts");
  select.payload.topic = "Unknown";
  assert.equal(validateSubmission(select).code, "invalid_choice");
  const product = cloneRequest("partneram-b2b");
  product.payload.product = "unknown-product";
  assert.equal(validateSubmission(product).code, "invalid_product");
  const length = cloneRequest("contacts");
  length.payload.message = "я".repeat(2001);
  assert.equal(validateSubmission(length).code, "too_long");
});

test("validates numeric-like fields without inventing a business maximum", () => {
  const invalid = cloneRequest("partneram-b2b");
  invalid.payload.store_count = "1.5";
  assert.equal(validateSubmission(invalid).code, "invalid_positive_integer");
  const valid = cloneRequest("partneram-b2b");
  valid.payload.store_count = "9999999999999999";
  assert.equal(validateSubmission(valid).ok, true);
});

test("accepts empty inactive gateway fields and rejects populated inactive fields", () => {
  const valid = cloneRequest("partner-gateway");
  assert.equal(validateSubmission(valid).ok, true);
  const invalid = cloneRequest("partner-gateway");
  invalid.payload.horeca_company = "Скрытое значение";
  assert.equal(validateSubmission(invalid).code, "inactive_scenario_field");
});

test("validates all three gateway scenarios", () => {
  const horeca = cloneRequest("partner-gateway");
  Object.assign(horeca.payload, {
    business_type: "HoReCa",
    retail_company: "",
    retail_store_count: "",
    retail_city: "",
    horeca_company: "Тестовое кафе",
    horeca_venue_type: "Кафе",
    horeca_city: "Тестовый город",
    request_type: "Заказать дегустацию",
  });
  assert.equal(validateSubmission(horeca).ok, true);

  const distributor = cloneRequest("partner-gateway");
  Object.assign(distributor.payload, {
    business_type: "Дистрибьютор",
    retail_company: "",
    retail_store_count: "",
    retail_city: "",
    distributor_company: "Тестовый дистрибьютор",
    distributor_region: "Тестовый регион",
    distributor_interest: "Обсудить сотрудничество",
    request_type: "Обсудить сотрудничество",
  });
  assert.equal(validateSubmission(distributor).ok, true);
});

test("suppresses honeypot submissions without validating business fields", () => {
  const input = cloneRequest("home-b2b");
  input.payload.company_site = "bot value";
  delete input.payload.name;
  const result = validateSubmission(input);
  assert.deepEqual(result, {
    ok: true,
    formId: "home-b2b",
    spam: true,
    payload: {},
  });
});
