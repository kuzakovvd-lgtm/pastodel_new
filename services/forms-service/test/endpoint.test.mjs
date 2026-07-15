import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import { startFormsService } from "../src/server.mjs";
import {
  cloneRequest,
  makeConfig,
  postJson,
  silentLogger,
  TEST_ORIGIN,
  validRequests,
  withTestServer,
} from "./helpers.mjs";

test("health returns no delivery configuration details", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "pastodel-forms",
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
});

test("health and forms routes enforce method allowlists", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const health = await fetch(`${baseUrl}/health`, { method: "POST" });
    assert.equal(health.status, 405);
    assert.equal(health.headers.get("allow"), "GET");
    const forms = await fetch(`${baseUrl}/api/forms`);
    assert.equal(forms.status, 405);
    assert.equal(forms.headers.get("allow"), "POST");
    const missing = await fetch(`${baseUrl}/other`);
    assert.equal(missing.status, 404);
  });
});

test("requires an allowed origin and JSON content type", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const missingOrigin = await fetch(`${baseUrl}/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cloneRequest("home-b2b")),
    });
    assert.equal(missingOrigin.status, 403);

    const badOrigin = await postJson(baseUrl, cloneRequest("home-b2b"), {
      headers: { Origin: "https://attacker.invalid" },
    });
    assert.equal(badOrigin.status, 403);

    const media = await postJson(baseUrl, cloneRequest("home-b2b"), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    assert.equal(media.status, 200);

    const unsupported = await postJson(baseUrl, cloneRequest("home-b2b"), {
      headers: { "Content-Type": "text/plain" },
    });
    assert.equal(unsupported.status, 415);
    assert.equal(unsupported.headers.get("access-control-allow-origin"), null);
  });
});

test("returns 400 for invalid JSON", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await postJson(baseUrl, null, { rawBody: "{" });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "invalid_json");
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
  });
});

test("returns 413 when Content-Length exceeds the configured limit", async () => {
  const config = makeConfig({ bodyLimitBytes: 128 });
  await withTestServer(
    async ({ baseUrl }) => {
      const response = await postJson(baseUrl, cloneRequest("contacts"));
      assert.equal(response.status, 413);
      assert.equal((await response.json()).code, "payload_too_large");
    },
    { config },
  );
});

test("returns generic 422 for validation failure", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const input = cloneRequest("contacts");
    input.payload.topic = "not-allowed";
    const response = await postJson(baseUrl, input);
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["code", "ok", "requestId"]);
    assert.equal(body.code, "validation_error");
    assert.doesNotMatch(JSON.stringify(body), /not-allowed/);
  });
});

test("accepts all five current frontend payloads", async () => {
  const delivery = createMockDelivery();
  await withTestServer(
    async ({ baseUrl }) => {
      for (const formId of Object.keys(validRequests)) {
        const response = await postJson(baseUrl, cloneRequest(formId));
        assert.equal(response.status, 200, formId);
        const body = await response.json();
        assert.equal(body.ok, true, formId);
        assert.equal(body.status, "accepted", formId);
        assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
      }
      assert.equal(delivery.getDeliveries().length, 5);
    },
    { delivery },
  );
});

test("honeypot returns accepted-like response without delivery", async () => {
  const delivery = createMockDelivery();
  await withTestServer(
    async ({ baseUrl }) => {
      const input = cloneRequest("home-b2b");
      input.payload.company_site = "bot";
      const response = await postJson(baseUrl, input);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "accepted");
      assert.equal(delivery.getDeliveries().length, 0);
    },
    { delivery },
  );
});

test("returns 503 on delivery failure and timeout", async () => {
  for (const mode of ["failure", "timeout"]) {
    const delivery = createMockDelivery({ mode });
    const config = makeConfig({ headersTimeoutMs: 50, requestTimeoutMs: 50 });
    await withTestServer(
      async ({ baseUrl }) => {
        const response = await postJson(baseUrl, cloneRequest("home-b2b"));
        assert.equal(response.status, 503, mode);
        const body = await response.json();
        assert.equal(body.code, "temporarily_unavailable");
        assert.equal(delivery.getDeliveries().length, 0);
      },
      { delivery, config },
    );
  }
});

test("supports injected proxy-style rate-limit decision without using client IP", async () => {
  await withTestServer(
    async ({ baseUrl }) => {
      const response = await postJson(baseUrl, cloneRequest("home-b2b"));
      assert.equal(response.status, 429);
      assert.equal(response.headers.get("retry-after"), "120");
      assert.equal((await response.json()).code, "rate_limited");
    },
    { requestGate: () => ({ allowed: false, retryAfterSeconds: 120 }) },
  );
});

test("bounds concurrent deliveries without creating a queue", async () => {
  let release;
  const delivery = {
    kind: "mock",
    send() {
      return new Promise((resolve) => {
        release = () => resolve({ accepted: true });
      });
    },
    close() {},
  };
  const config = makeConfig({ maxInFlight: 1 });
  await withTestServer(
    async ({ baseUrl, server }) => {
      const first = postJson(baseUrl, cloneRequest("contacts"));
      while (server.getInFlightDeliveryCount() !== 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      const excess = await postJson(baseUrl, cloneRequest("contacts"));
      assert.equal(excess.status, 503);
      assert.equal((await excess.json()).code, "temporarily_unavailable");
      release();
      assert.equal((await first).status, 200);
    },
    { config, delivery },
  );
});

test("handles concurrent accepted requests", async () => {
  const delivery = createMockDelivery({ delayMs: 5 });
  const config = makeConfig({ maxInFlight: 25 });
  await withTestServer(
    async ({ baseUrl }) => {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () =>
          postJson(baseUrl, cloneRequest("contacts")),
        ),
      );
      assert.ok(responses.every((response) => response.status === 200));
      assert.equal(delivery.getDeliveries().length, 20);
    },
    { config, delivery },
  );
});

test("test server binds only to loopback", async () => {
  await withTestServer(async ({ address }) => {
    assert.equal(address.address, "127.0.0.1");
    assert.equal(address.family, "IPv4");
  });
});

test("startup fails cleanly on a port conflict", async () => {
  const blocker = createServer();
  blocker.listen(0, "127.0.0.1");
  await new Promise((resolve) => blocker.once("listening", resolve));
  const address = blocker.address();
  const config = makeConfig({ port: address.port });
  await assert.rejects(
    () =>
      startFormsService({
        config,
        delivery: createMockDelivery(),
        logger: silentLogger,
      }),
    (error) => error?.code === "EADDRINUSE",
  );
  await new Promise((resolve) => blocker.close(resolve));
});

test("valid origin constant is explicit in test requests", () => {
  assert.equal(TEST_ORIGIN, "http://forms.test");
});
