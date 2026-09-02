import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_GAME_ENGINE = "phoenix";
process.env.NEXT_PUBLIC_GAME_SERVICE_URL = "https://quizworld-xs0g.onrender.com";

type Listener = (event?: { data?: string }) => void;

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  send(message: string) { this.sent.push(message); }

  close() {
    this.readyState = 3;
  }

  emit(name: string, event: { data?: string } = {}) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

Object.defineProperty(globalThis, "WebSocket", { value: FakeWebSocket, configurable: true });
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });

test("the game socket joins with host-player credentials", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");

  const unsubscribe = subscribeToPhoenixTopic({
    topic: "game:TEST01",
    joinPayload: { host_token: "host-secret", player_id: "player-1", player_token: "player-secret" },
  });
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");

  const [, , , event, payload] = JSON.parse(socket.sent[0]) as [null, string, string, string, Record<string, string>];
  assert.equal(event, "phx_join");
  assert.deepEqual(payload, { host_token: "host-secret", player_id: "player-1", player_token: "player-secret" });
  unsubscribe();
});

test("game commands use the existing socket and resolve from Phoenix replies", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");

  const subscription = subscribeToPhoenixTopic({ topic: "game:TEST01" });
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");

  const pending = subscription.push("player:answer", {
    player_id: "player-1",
    player_token: "player-secret",
    answer_id: "answer-1",
    response_time_ms: 250,
  });

  const [, commandRef, topic, event, payload] = JSON.parse(socket.sent[1]) as [
    null,
    string,
    string,
    string,
    Record<string, unknown>,
  ];
  assert.equal(topic, "game:TEST01");
  assert.equal(event, "player:answer");
  assert.equal(payload.answer_id, "answer-1");

  socket.emit("message", {
    data: JSON.stringify([null, commandRef, topic, "phx_reply", {
      status: "ok",
      response: { session: { status: "active" } },
    }]),
  });

  assert.deepEqual(await pending, { session: { status: "active" } });
  subscription();
});

test("game command errors preserve the Phoenix reason for existing UI recovery", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");

  const subscription = subscribeToPhoenixTopic({ topic: "game:TEST01" });
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");

  const pending = subscription.push("player:answer", { answer_id: "answer-1" });
  const [, commandRef, topic] = JSON.parse(socket.sent[1]) as [null, string, string];
  socket.emit("message", {
    data: JSON.stringify([null, commandRef, topic, "phx_reply", {
      status: "error",
      response: { reason: "already_answered" },
    }]),
  });

  await assert.rejects(pending, /Your answer is already locked in\./);
  subscription();
});

test("channel errors reject in-flight commands and force a clean reconnect", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const subscription = subscribeToPhoenixTopic({ topic: "game:TEST01" });
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  const pending = subscription.push("player:answer", { answer_id: "answer-1" });

  socket.emit("message", {
    data: JSON.stringify([null, null, "game:TEST01", "phx_error", {}]),
  });

  try {
    await assert.rejects(
      Promise.race([
        pending,
        new Promise((_, reject) => setTimeout(() => reject(new Error("command stayed pending")), 30)),
      ]),
      /Phoenix channel error\./
    );
    assert.equal(socket.readyState, 3);
  } finally {
    subscription();
  }
});

test("game commands have a bounded reply timeout", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const subscription = subscribeToPhoenixTopic({
    topic: "game:TEST01",
    commandTimeoutMs: 10,
  });
  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");

  try {
    await assert.rejects(
      Promise.race([
        subscription.push("player:answer", { answer_id: "answer-1" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("command stayed pending")), 30)),
      ]),
      /timed out/
    );
  } finally {
    subscription();
  }
});

test("a dropped game socket immediately reports disconnected while reconnecting", async () => {
  FakeWebSocket.instances = [];
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");

  let closeCount = 0;
  const unsubscribe = subscribeToPhoenixTopic({
    topic: "game:TEST01",
    onClose: () => {
      closeCount += 1;
    },
  });

  const socket = FakeWebSocket.instances[0];
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  socket.readyState = 3;
  socket.emit("close");

  await new Promise((resolve) => setTimeout(resolve, 20));
  unsubscribe();

  assert.equal(closeCount, 1);
});
