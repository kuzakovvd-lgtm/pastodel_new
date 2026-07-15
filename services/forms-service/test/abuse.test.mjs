import assert from "node:assert/strict";
import test from "node:test";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import { cloneRequest, makeConfig, postJson, withTestServer } from "./helpers.mjs";

test("streaming body limit rejects a chunked oversized request", async () => {
  const config = makeConfig({ bodyLimitBytes: 256 });
  await withTestServer(
    async ({ baseUrl }) => {
      const oversized = JSON.stringify({
        form: "contacts",
        payload: { message: "x".repeat(500) },
      });
      const response = await fetch(`${baseUrl}/api/forms`, {
        method: "POST",
        headers: {
          Origin: config.allowedOrigin,
          "Content-Type": "application/json",
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(oversized));
            controller.close();
          },
        }),
        duplex: "half",
      });
      assert.equal(response.status, 413);
    },
    { config },
  );
});

test("request body timeout returns a bounded generic error", async () => {
  const config = makeConfig({ headersTimeoutMs: 30, requestTimeoutMs: 30 });
  await withTestServer(
    async ({ baseUrl }) => {
      const slowBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{"));
          setTimeout(() => controller.close(), 80);
        },
      });
      const response = await fetch(`${baseUrl}/api/forms`, {
        method: "POST",
        headers: {
          Origin: config.allowedOrigin,
          "Content-Type": "application/json",
        },
        body: slowBody,
        duplex: "half",
      });
      assert.equal(response.status, 408);
      assert.equal((await response.json()).code, "request_timeout");
    },
    { config },
  );
});

test("unexpected nested data and arrays are rejected", async () => {
  await withTestServer(async ({ baseUrl }) => {
    for (const payload of [{ name: { nested: true } }, []]) {
      const response = await postJson(baseUrl, {
        form: "home-b2b",
        payload,
      });
      assert.equal(response.status, 422);
    }
  });
});

test("delivery is never attempted for invalid or honeypot input", async () => {
  const delivery = createMockDelivery();
  await withTestServer(
    async ({ baseUrl }) => {
      const invalid = cloneRequest("home-b2b");
      invalid.payload.email = "invalid";
      assert.equal((await postJson(baseUrl, invalid)).status, 422);

      const spam = cloneRequest("home-b2b");
      spam.payload.company_site = "filled";
      assert.equal((await postJson(baseUrl, spam)).status, 200);
      assert.equal(delivery.getDeliveries().length, 0);
    },
    { delivery },
  );
});
