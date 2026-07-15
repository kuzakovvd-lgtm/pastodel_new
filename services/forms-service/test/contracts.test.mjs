import assert from "node:assert/strict";
import test from "node:test";

import { FORM_CONTRACTS, FORM_IDS, PRODUCT_SLUGS } from "../src/contracts.mjs";

test("the service exposes exactly the five current form IDs", () => {
  assert.deepEqual(FORM_IDS, [
    "home-b2b",
    "partneram-b2b",
    "horeca-request",
    "partner-gateway",
    "contacts",
  ]);
});

test("all form contracts have stable routing metadata", () => {
  for (const contract of Object.values(FORM_CONTRACTS)) {
    assert.match(contract.page, /^\/$|^\/.+\/$/);
    assert.match(contract.subjectPrefix, /^\[PASTODEL\]\[[A-Z]+\]$/);
    assert.ok(Object.keys(contract.fields).includes("privacy"));
    assert.ok(Object.keys(contract.fields).includes("company_site"));
  }
});

test("select values match the current frontend", () => {
  assert.deepEqual(FORM_CONTRACTS["partneram-b2b"].fields.request_type.values, [
    "Запрос условий",
    "Коммерческое предложение",
    "Обсуждение пилота",
  ]);
  assert.deepEqual(FORM_CONTRACTS["horeca-request"].fields.request_type.values, [
    "Заказать дегустацию",
    "Обсудить условия",
    "Запрос по HoReCa",
  ]);
  assert.deepEqual(FORM_CONTRACTS.contacts.fields.topic.values, [
    "Сотрудничество и продажи",
    "Качество и упаковка",
    "Закупки и коммерческие предложения",
    "Общий вопрос",
  ]);
});

test("product slug allowlist mirrors the current central product data", () => {
  assert.equal(PRODUCT_SLUGS.length, 11);
  assert.ok(PRODUCT_SLUGS.includes("karbonara"));
  assert.ok(PRODUCT_SLUGS.includes("paelya-kuritsa-ovoshchi"));
});
