import assert from "node:assert/strict";
import test from "node:test";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import {
  cloneRequest,
  makeConfig,
  postJson,
  validRequests,
  withTestServer,
} from "./helpers.mjs";

const currentFrontendAccepts = async (response) => {
  if (!response.ok) return false;
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    return false;
  }
  const body = await response.json();
  return (
    body?.ok === true &&
    (body.status === "accepted" ||
      body.status === "queued" ||
      body.status === undefined)
  );
};

for (const formId of Object.keys(validRequests)) {
  test(`${formId} success response is compatible with current FormRuntime`, async () => {
    await withTestServer(async ({ baseUrl }) => {
      const response = await postJson(baseUrl, cloneRequest(formId));
      assert.equal(await currentFrontendAccepts(response), true);
    });
  });
}

test("422, 429 and 503 remain failures for current FormRuntime", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const invalid = cloneRequest("contacts");
    delete invalid.payload.message;
    assert.equal(await currentFrontendAccepts(await postJson(baseUrl, invalid)), false);
  });

  await withTestServer(
    async ({ baseUrl }) => {
      assert.equal(
        await currentFrontendAccepts(
          await postJson(baseUrl, cloneRequest("contacts")),
        ),
        false,
      );
    },
    { requestGate: () => ({ allowed: false }) },
  );

  await withTestServer(
    async ({ baseUrl }) => {
      assert.equal(
        await currentFrontendAccepts(
          await postJson(baseUrl, cloneRequest("contacts")),
        ),
        false,
      );
    },
    {
      config: makeConfig({ headersTimeoutMs: 100, requestTimeoutMs: 100 }),
      delivery: createMockDelivery({ mode: "failure" }),
    },
  );
});
