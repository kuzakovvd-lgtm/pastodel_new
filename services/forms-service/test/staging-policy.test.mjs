import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.mjs";
import { startFormsService } from "../src/server.mjs";
import {
  baseEnv,
  silentLogger,
  validRequests,
} from "./helpers.mjs";

const stagingEnv = (overrides = {}) =>
  baseEnv({
    NODE_ENV: "staging",
    PASTODEL_ALLOWED_ORIGIN: "https://pastodel.ru",
    PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING: "true",
    ...overrides,
  });

test("staging mock policy starts the real loopback service", async () => {
  const loadedConfig = loadConfig(stagingEnv());
  const config = { ...loadedConfig, port: 0 };
  const service = await startFormsService({ config, logger: silentLogger });
  try {
    const address = service.server.address();
    assert.equal(address.address, "127.0.0.1");
    assert.equal(service.delivery.kind, "mock");

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "pastodel-forms",
    });

    const form = await fetch(`${baseUrl}/api/forms`, {
      method: "POST",
      headers: {
        Origin: "https://pastodel.ru",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validRequests.contacts),
    });
    assert.equal(form.status, 200);
    assert.equal((await form.json()).status, "accepted");
    assert.equal(service.delivery.getDeliveries().length, 1);
  } finally {
    await service.close();
  }
});

for (const [name, overrides, code] of [
  [
    "staging mock startup rejects an absent flag",
    { PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING: undefined },
    "mock_not_allowed_in_staging",
  ],
  [
    "staging mock startup rejects false",
    { PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING: "false" },
    "mock_not_allowed_in_staging",
  ],
  [
    "staging mock startup rejects invalid flag text",
    { PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING: "yes" },
    "mock_not_allowed_in_staging",
  ],
  [
    "production mock startup rejects the staging override",
    { NODE_ENV: "production", PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING: "true" },
    "mock_forbidden_in_production",
  ],
]) {
  test(name, () => {
    assert.throws(
      () => loadConfig(stagingEnv(overrides)),
      (error) => error?.code === code,
    );
  });
}
