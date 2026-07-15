import { FORM_CONTRACTS, PRODUCT_SLUGS } from "./contracts.mjs";

const PRODUCT_SLUG_SET = new Set(PRODUCT_SLUGS);
const TOP_LEVEL_FIELDS = new Set(["form", "payload"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_PATTERN = /^[0-9+()\- .]+$/u;
const FORBIDDEN_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const ALTERNATE_LINE_BREAKS = /\u0085|\u2028|\u2029/gu;

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const normalizeText = (value, { multiline = false } = {}) => {
  if (typeof value !== "string") return { ok: false, code: "invalid_type" };
  const normalized = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(ALTERNATE_LINE_BREAKS, "\n")
    .trim();
  if (FORBIDDEN_CONTROLS.test(normalized)) {
    return { ok: false, code: "control_character" };
  }
  if (!multiline && normalized.includes("\n")) {
    return { ok: false, code: "line_break_not_allowed" };
  }
  return { ok: true, value: normalized };
};

const normalizeEmail = (value) => {
  const normalized = normalizeText(value);
  if (!normalized.ok) return normalized;
  if (!EMAIL_PATTERN.test(normalized.value)) {
    return { ok: false, code: "invalid_email" };
  }
  const at = normalized.value.lastIndexOf("@");
  return {
    ok: true,
    value: `${normalized.value.slice(0, at)}@${normalized.value.slice(at + 1).toLowerCase()}`,
  };
};

const normalizePhone = (value) => {
  const normalized = normalizeText(value);
  if (!normalized.ok) return normalized;
  if (!PHONE_PATTERN.test(normalized.value)) {
    return { ok: false, code: "invalid_phone_characters" };
  }
  const digits = normalized.value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, code: "invalid_phone_length" };
  }
  return normalized;
};

const isRequired = (definition, payload) => {
  if (definition.required) return true;
  return Boolean(
    definition.requiredFor &&
      payload.business_type === definition.requiredFor.businessType,
  );
};

const isInactiveGatewayField = (definition, payload) =>
  Boolean(
    definition.requiredFor &&
      payload.business_type !== definition.requiredFor.businessType,
  );

const normalizeField = (value, definition) => {
  if (definition.type === "consent") {
    return value === "on"
      ? { ok: true, value: true }
      : { ok: false, code: "consent_required" };
  }

  const base = normalizeText(value, { multiline: definition.multiline });
  if (!base.ok) return base;
  if (base.value.length > definition.maxLength) {
    return { ok: false, code: "too_long" };
  }

  if (definition.type === "email") return normalizeEmail(base.value);
  if (definition.type === "phone") return normalizePhone(base.value);
  if (definition.type === "select" && !definition.values.includes(base.value)) {
    return { ok: false, code: "invalid_choice" };
  }
  if (
    definition.type === "positiveInteger" &&
    !/^[1-9]\d*$/.test(base.value)
  ) {
    return { ok: false, code: "invalid_positive_integer" };
  }
  if (
    definition.type === "productSlug" &&
    base.value &&
    !PRODUCT_SLUG_SET.has(base.value)
  ) {
    return { ok: false, code: "invalid_product" };
  }
  return base;
};

export const validateSubmission = (input) => {
  if (!isPlainObject(input)) {
    return { ok: false, code: "invalid_envelope" };
  }
  if (Object.keys(input).some((key) => !TOP_LEVEL_FIELDS.has(key))) {
    return { ok: false, code: "unexpected_top_level_field" };
  }
  if (typeof input.form !== "string" || !FORM_CONTRACTS[input.form]) {
    return { ok: false, code: "unknown_form" };
  }
  if (!isPlainObject(input.payload)) {
    return { ok: false, code: "invalid_payload" };
  }

  const contract = FORM_CONTRACTS[input.form];
  const allowedFields = new Set(Object.keys(contract.fields));
  if (Object.keys(input.payload).some((key) => !allowedFields.has(key))) {
    return { ok: false, code: "unexpected_payload_field" };
  }
  if (
    Object.values(input.payload).some((value) => typeof value !== "string")
  ) {
    return { ok: false, code: "invalid_field_type" };
  }

  const honeypotValue = input.payload.company_site ?? "";
  const normalizedHoneypot = normalizeText(honeypotValue);
  if (!normalizedHoneypot.ok || normalizedHoneypot.value.length > 256) {
    return { ok: false, code: "invalid_honeypot" };
  }
  if (normalizedHoneypot.value) {
    return { ok: true, formId: input.form, spam: true, payload: {} };
  }

  const normalizedPayload = {};
  for (const [name, definition] of Object.entries(contract.fields)) {
    if (definition.type === "honeypot") continue;
    const supplied = Object.hasOwn(input.payload, name);
    const rawValue = supplied ? input.payload[name] : "";
    const scenarioPayload = { ...input.payload, ...normalizedPayload };
    const required = isRequired(definition, scenarioPayload);

    if (isInactiveGatewayField(definition, scenarioPayload)) {
      const inactive = normalizeText(rawValue, {
        multiline: definition.multiline,
      });
      if (!inactive.ok || inactive.value) {
        return { ok: false, code: "inactive_scenario_field", field: name };
      }
      normalizedPayload[name] = "";
      continue;
    }

    if (!rawValue && !required) {
      normalizedPayload[name] = "";
      continue;
    }
    if (!rawValue && required) {
      return {
        ok: false,
        code: definition.type === "consent" ? "consent_required" : "required_field",
        field: name,
      };
    }

    const normalized = normalizeField(rawValue, definition);
    if (!normalized.ok) {
      return { ok: false, code: normalized.code, field: name };
    }
    if (required && normalized.value === "") {
      return { ok: false, code: "required_field", field: name };
    }
    normalizedPayload[name] = normalized.value;
  }

  return {
    ok: true,
    formId: input.form,
    spam: false,
    payload: normalizedPayload,
  };
};
