import assert from "node:assert/strict";
import test from "node:test";

import { createMockDelivery } from "../src/delivery/mock.mjs";
import { startFormsService } from "../src/server.mjs";
import {
  cloneRequest,
  makeConfig,
  postJson,
  silentLogger,
} from "./helpers.mjs";

const waitFor = async (predicate, timeoutMs = 500) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("wait_timeout");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
};

const serviceUrl = (service) => {
  const address = service.server.address();
  return `http://127.0.0.1:${address.port}`;
};

const shutdownRequestStatus = (request) =>
  request.then((response) => response.status).catch(() => 0);

test("graceful shutdown closes an idle listener and delivery adapter", async () => {
  const delivery = createMockDelivery();
  const service = await startFormsService({
    config: makeConfig(),
    delivery,
    logger: silentLogger,
  });
  assert.equal(service.server.listening, true);
  await service.close();
  assert.equal(service.server.listening, false);
});

test("graceful shutdown waits for an in-flight successful delivery", async () => {
  let release;
  let closed = false;
  const delivery = {
    kind: "mock",
    send() {
      return new Promise((resolve) => {
        release = () => resolve({ accepted: true });
      });
    },
    close() { closed = true; },
  };
  const service = await startFormsService({
    config: makeConfig({ shutdownTimeoutMs: 300 }),
    delivery,
    logger: silentLogger,
  });
  const request = postJson(serviceUrl(service), cloneRequest("contacts"));
  await waitFor(() => service.server.getInFlightDeliveryCount() === 1);
  const closing = service.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(closed, false);
  release();
  assert.equal((await request).status, 200);
  await closing;
  assert.equal(closed, true);
  assert.equal(service.server.listening, false);
});

test("shutdown timeout aborts a stuck delivery and remains bounded", async () => {
  let closed = false;
  const delivery = {
    kind: "mock",
    send() { return new Promise(() => {}); },
    close() { closed = true; },
  };
  const service = await startFormsService({
    config: makeConfig({
      requestTimeoutMs: 1000,
      shutdownTimeoutMs: 40,
    }),
    delivery,
    logger: silentLogger,
  });
  const request = postJson(serviceUrl(service), cloneRequest("contacts"));
  await waitFor(() => service.server.getInFlightDeliveryCount() === 1);
  const started = Date.now();
  await service.close();
  assert.ok(Date.now() - started < 500);
  assert.equal(closed, true);
  assert.equal(service.server.getInFlightDeliveryCount(), 0);
  assert.ok([0, 503].includes(await shutdownRequestStatus(request)));
});

test("a forced second close aborts in-flight work immediately", async () => {
  const delivery = {
    kind: "mock",
    send() { return new Promise(() => {}); },
    close() {},
  };
  const service = await startFormsService({
    config: makeConfig({
      requestTimeoutMs: 1000,
      shutdownTimeoutMs: 400,
    }),
    delivery,
    logger: silentLogger,
  });
  const request = postJson(serviceUrl(service), cloneRequest("contacts"));
  await waitFor(() => service.server.getInFlightDeliveryCount() === 1);
  const graceful = service.close();
  const started = Date.now();
  await service.close({ force: true });
  await graceful;
  assert.ok(Date.now() - started < 300);
  assert.ok([0, 503].includes(await shutdownRequestStatus(request)));
});
