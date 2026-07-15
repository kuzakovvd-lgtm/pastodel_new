import assert from "node:assert/strict";
import test from "node:test";

import { createLogger } from "../src/logging.mjs";
import { cloneRequest, postJson, withTestServer } from "./helpers.mjs";

const captureStream = () => {
  let output = "";
  return {
    stream: { write(chunk) { output += chunk; } },
    read: () => output,
  };
};

test("logger emits only the operational allowlist", () => {
  const capture = captureStream();
  const logger = createLogger({
    stream: capture.stream,
    now: () => new Date("2026-07-15T08:00:00Z"),
  });
  logger.info("submission_handled", {
    requestId: "request-1",
    formId: "contacts",
    status: 200,
    outcome: "accepted",
    durationMs: 12,
    reasonCode: "delivery_accepted",
    payload: { email: "private@example.invalid" },
    email: "private@example.invalid",
    company: "Private company",
    smtpPassword: "SECRET_CANARY",
    error: new Error("provider leaked SECRET_CANARY"),
  });
  const entry = JSON.parse(capture.read());
  assert.deepEqual(Object.keys(entry).sort(), [
    "durationMs",
    "event",
    "formId",
    "level",
    "outcome",
    "reasonCode",
    "requestId",
    "status",
    "timestamp",
  ]);
  assert.doesNotMatch(
    capture.read(),
    /private@example\.invalid|Private company|SECRET_CANARY|provider leaked/,
  );
});

test("logger neutralizes line breaks in allowlisted metadata", () => {
  const capture = captureStream();
  const logger = createLogger({ stream: capture.stream });
  logger.error("event\r\nforged", {
    requestId: "id\r\nforged",
    reasonCode: "reason\u0000forged",
  });
  assert.doesNotMatch(capture.read(), /\r|\nforged|\u0000/u);
  const entry = JSON.parse(capture.read());
  assert.equal(entry.event, "event_forged");
  assert.equal(entry.requestId, "id_forged");
  assert.equal(entry.reasonCode, "reason_forged");
});

test("accepted request logs contain correlation fields but no submitted PII", async () => {
  const capture = captureStream();
  const logger = createLogger({ stream: capture.stream });
  await withTestServer(
    async ({ baseUrl }) => {
      const input = cloneRequest("contacts");
      const response = await postJson(baseUrl, input);
      assert.equal(response.status, 200);
      const body = await response.json();
      const log = capture.read();
      assert.match(log, new RegExp(body.requestId));
      assert.match(log, /"formId":"contacts"/);
      assert.match(log, /"outcome":"accepted"/);
      for (const [field, value] of Object.entries(input.payload)) {
        if (field === "privacy" || field === "company_site") continue;
        if (value) assert.doesNotMatch(log, new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    },
    { logger },
  );
});

test("malformed JSON body and SMTP provider error text are never logged", async () => {
  const capture = captureStream();
  const logger = createLogger({ stream: capture.stream });
  await withTestServer(
    async ({ baseUrl }) => {
      const malformed = await postJson(baseUrl, null, {
        rawBody: '{"canary":"PRIVATE_BODY_CANARY"',
      });
      assert.equal(malformed.status, 400);
    },
    { logger },
  );
  assert.doesNotMatch(capture.read(), /PRIVATE_BODY_CANARY/);
});
