import assert from "node:assert/strict";
import test from "node:test";
import { executePhoenixGameCommand } from "./command-transport";

test("connected games send commands through the existing socket", async () => {
  let socketCalls = 0;
  let restCalls = 0;

  const result = await executePhoenixGameCommand({
    connected: true,
    event: "player:answer",
    payload: { answer_id: "a1" },
    sendSocketCommand: async () => {
      socketCalls += 1;
      return { session: { status: "active" } };
    },
    sendRestCommand: async () => {
      restCalls += 1;
      return { session: { status: "active" } };
    },
  });

  assert.deepEqual(result, { session: { status: "active" } });
  assert.equal(socketCalls, 1);
  assert.equal(restCalls, 0);
});

test("games fall back to REST before the socket is connected", async () => {
  let socketCalls = 0;
  let restCalls = 0;

  await executePhoenixGameCommand({
    connected: false,
    event: "host:start",
    payload: { host_token: "token" },
    sendSocketCommand: async () => {
      socketCalls += 1;
      return {};
    },
    sendRestCommand: async () => {
      restCalls += 1;
      return {};
    },
  });

  assert.equal(socketCalls, 0);
  assert.equal(restCalls, 1);
});
