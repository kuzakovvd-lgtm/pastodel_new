import assert from "node:assert/strict";
import test from "node:test";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import { createSmtpDelivery } from "../src/delivery/smtp.mjs";
import { DeliveryError, DeliveryTimeoutError } from "../src/delivery/errors.mjs";
import { buildMailMessage } from "../src/subjects.mjs";
import { validateSubmission } from "../src/validate.mjs";
import {
  APPROVED_RECIPIENT,
  cloneRequest,
  makeConfig,
} from "./helpers.mjs";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";

test("mail uses approved recipient, prefix, request ID and Reply-To", () => {
  const validated = validateSubmission(cloneRequest("partneram-b2b"));
  const message = buildMailMessage({
    formId: validated.formId,
    payload: validated.payload,
    requestId: REQUEST_ID,
    recipient: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    replyToEnabled: true,
    now: () => new Date("2026-07-15T08:00:00Z"),
  });
  assert.equal(message.to, APPROVED_RECIPIENT);
  assert.equal(message.from, "forms@example.invalid");
  assert.equal(message.replyTo, "retail+test@example.invalid");
  assert.match(message.subject, /^\[PASTODEL\]\[RETAIL\]/);
  assert.match(message.subject, new RegExp(`\\[ID: ${REQUEST_ID}\\]$`));
  assert.match(message.text, new RegExp(`Request ID: ${REQUEST_ID}`));
  assert.doesNotMatch(message.text, /company_site/);
});

test("mail field order follows the contract, not JSON input order", () => {
  const input = cloneRequest("contacts");
  input.payload = Object.fromEntries(Object.entries(input.payload).reverse());
  const validated = validateSubmission(input);
  const message = buildMailMessage({
    formId: validated.formId,
    payload: validated.payload,
    requestId: REQUEST_ID,
    recipient: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    replyToEnabled: true,
  });
  assert.ok(message.text.indexOf("— Имя:") < message.text.indexOf("— Компания:"));
  assert.ok(message.text.indexOf("— Компания:") < message.text.indexOf("— Тема:"));
  assert.match(message.text, /— Сообщение:\n  \| Тестовое обращение\./);
  assert.equal(message.disableFileAccess, true);
  assert.equal(message.disableUrlAccess, true);
});

test("all forms use their approved subject prefix and the common recipient", () => {
  const expectedPrefixes = {
    "home-b2b": "[PASTODEL][HOME]",
    "partneram-b2b": "[PASTODEL][RETAIL]",
    "horeca-request": "[PASTODEL][HORECA]",
    "partner-gateway": "[PASTODEL][PARTNER]",
    contacts: "[PASTODEL][CONTACT]",
  };
  for (const [formId, prefix] of Object.entries(expectedPrefixes)) {
    const validated = validateSubmission(cloneRequest(formId));
    const message = buildMailMessage({
      formId,
      payload: validated.payload,
      requestId: REQUEST_ID,
      recipient: APPROVED_RECIPIENT,
      from: "forms@example.invalid",
      replyToEnabled: false,
    });
    assert.equal(message.to, APPROVED_RECIPIENT);
    assert.ok(message.subject.startsWith(prefix));
    assert.equal(message.replyTo, undefined);
  }
});

test("subject hardening removes line breaks and caps context", () => {
  const message = buildMailMessage({
    formId: "home-b2b",
    payload: {
      company: `Компания\r\nBcc: test@example.invalid\u2028${"x".repeat(200)}`,
      email: "reply@example.invalid",
    },
    requestId: REQUEST_ID,
    recipient: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    replyToEnabled: true,
  });
  assert.doesNotMatch(message.subject, /[\r\n\u2028\u2029]/u);
  assert.ok(message.subject.length <= 240);
});

test("subject treats encoded-word and display-name syntax as bounded text", () => {
  const message = buildMailMessage({
    formId: "home-b2b",
    payload: {
      company: '=?UTF-8?B?ZmFrZQ==?=, "CEO" <ceo@example.invalid>',
      email: "reply@example.invalid",
    },
    requestId: REQUEST_ID,
    recipient: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    replyToEnabled: true,
  });
  assert.ok(message.subject.startsWith("[PASTODEL][HOME]"));
  assert.match(message.subject, new RegExp(`\\[ID: ${REQUEST_ID}\\]$`));
  assert.doesNotMatch(message.subject, /[\r\n]/u);
});

test("plain-text field blocks prevent user text from imitating service sections", () => {
  const validated = validateSubmission({
    ...cloneRequest("contacts"),
    payload: {
      ...cloneRequest("contacts").payload,
      message: "Первая строка\nСогласие:\n— Подтверждено злоумышленником",
    },
  });
  const message = buildMailMessage({
    formId: validated.formId,
    payload: validated.payload,
    requestId: REQUEST_ID,
    recipient: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    replyToEnabled: true,
  });
  assert.match(message.text, /  \| Согласие:/);
  assert.match(message.text, /  \| — Подтверждено злоумышленником/);
  assert.equal(message.text.match(/^Согласие:$/gm)?.length, 1);
});

test("mock adapter supports success, failure and timeout without external delivery", async () => {
  const success = createMockDelivery();
  await success.send({ subject: "test" });
  assert.equal(success.getDeliveries().length, 1);

  const failure = createMockDelivery({ mode: "failure" });
  await assert.rejects(() => failure.send({}), DeliveryError);

  const timeout = createMockDelivery({ mode: "timeout" });
  const controller = new AbortController();
  const pending = timeout.send({}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(() => pending, DeliveryTimeoutError);
});

test("SMTP adapter confirms acceptance without calling verify or the network", async () => {
  let transportOptions;
  let sentMessage;
  let verifyCalled = false;
  const fakeTransport = {
    async sendMail(message) {
      sentMessage = message;
      return { accepted: [APPROVED_RECIPIENT], rejected: [] };
    },
    async verify() {
      verifyCalled = true;
    },
    close() {},
  };
  const delivery = createSmtpDelivery(makeConfig({ delivery: "smtp" }), {
    transportFactory(options) {
      transportOptions = options;
      return fakeTransport;
    },
  });
  const result = await delivery.send({
    to: APPROVED_RECIPIENT,
    from: "forms@example.invalid",
    subject: "test",
    text: "plain text",
  });
  assert.deepEqual(result, { accepted: true });
  assert.equal(verifyCalled, false);
  assert.equal(transportOptions.pool, undefined);
  assert.equal(transportOptions.logger, false);
  assert.equal(transportOptions.debug, false);
  assert.equal(transportOptions.requireTLS, true);
  assert.equal(transportOptions.ignoreTLS, false);
  assert.equal(transportOptions.opportunisticTLS, false);
  assert.equal(transportOptions.disableFileAccess, true);
  assert.equal(transportOptions.disableUrlAccess, true);
  assert.equal(transportOptions.tls.minVersion, "TLSv1.2");
  assert.equal(transportOptions.tls.rejectUnauthorized, true);
  assert.equal(transportOptions.connectionTimeout, 1000);
  assert.equal(transportOptions.greetingTimeout, 1000);
  assert.equal(transportOptions.socketTimeout, 1000);
  assert.equal(transportOptions.dnsTimeout, 1000);
  assert.equal(sentMessage.disableFileAccess, true);
  assert.equal(sentMessage.disableUrlAccess, true);
  assert.equal(sentMessage.attachments, undefined);
});

test("SMTP adapter requires the configured recipient to be accepted", async () => {
  for (const result of [
    { accepted: [], rejected: [APPROVED_RECIPIENT] },
    { accepted: ["other@example.invalid"], rejected: [] },
    {
      accepted: ["other@example.invalid"],
      rejected: [APPROVED_RECIPIENT],
    },
    {},
  ]) {
    const unaccepted = createSmtpDelivery(makeConfig({ delivery: "smtp" }), {
      transportFactory: () => ({ async sendMail() { return result; } }),
    });
    await assert.rejects(
      () => unaccepted.send({ to: APPROVED_RECIPIENT }),
      (error) =>
        error instanceof DeliveryError && error.code === "smtp_not_accepted",
    );
  }
});

test("SMTP adapter redacts provider failures", async () => {
  const failed = createSmtpDelivery(makeConfig({ delivery: "smtp" }), {
    transportFactory: () => ({
      async sendMail() {
        throw new Error("provider detail must not escape");
      },
    }),
  });
  await assert.rejects(
    () => failed.send({ to: APPROVED_RECIPIENT }),
    (error) => error instanceof DeliveryError && error.code === "smtp_delivery_failed",
  );
});

test("SMTP adapter maps implicit TLS and supports explicit verify", async () => {
  let options;
  let verifyCalls = 0;
  const delivery = createSmtpDelivery(
    makeConfig({
      delivery: "smtp",
      smtp: {
        ...makeConfig().smtp,
        port: 465,
        secure: true,
        requireTLS: false,
      },
    }),
    {
      transportFactory(transportOptions) {
        options = transportOptions;
        return {
          async verify() { verifyCalls += 1; return true; },
          close() {},
        };
      },
    },
  );
  assert.deepEqual(await delivery.verify(), { verified: true });
  assert.equal(verifyCalls, 1);
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.requireTLS, false);
});

test("SMTP adapter aborts a pending transport without exposing details", async () => {
  let closeCalls = 0;
  const delivery = createSmtpDelivery(makeConfig({ delivery: "smtp" }), {
    transportFactory: () => ({
      sendMail() { return new Promise(() => {}); },
      close() { closeCalls += 1; },
    }),
  });
  const controller = new AbortController();
  const pending = delivery.send(
    { to: APPROVED_RECIPIENT },
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, DeliveryTimeoutError);
  assert.equal(closeCalls, 1);
});
