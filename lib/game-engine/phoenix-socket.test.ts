import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_GAME_ENGINE = "phoenix";
process.env.NEXT_PUBLIC_GAME_SERVICE_URL = "http://127.0.0.1:4000";

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

test("an expired command reply is not a join even before the join reply arrives", async () => {
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const joins: unknown[] = [];
  const updates: unknown[] = [];
  const subscription = subscribeToPhoenixTopic({
    topic: "game:TEST01",
    commandTimeoutMs: 10,
    onJoin: payload => joins.push(payload),
    onSessionUpdate: payload => updates.push(payload),
  });
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  try {
    await assert.rejects(subscription.push("player:ready"), /timed out/);
    const [, commandRef, topic] = JSON.parse(socket.sent[1]);
    socket.emit("message", { data: JSON.stringify([null, commandRef, topic, "phx_reply", {
      status: "ok", response: { session: { revision: 5 } },
    }]) });
    assert.deepEqual(joins, []);
    assert.deepEqual(updates, []);
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


function reply(socket: FakeWebSocket, ref: string | null, response: unknown, status = "ok", topic = "game:TEST01") {
  socket.emit("message", { data: JSON.stringify([null, ref, topic, "phx_reply", { status, response }]) });
}

test("only one successful matching join reply receives join semantics", async () => {
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const joins: unknown[] = [];
  const updates: unknown[] = [];
  const subscription = subscribeToPhoenixTopic({
    topic: "game:TEST01", onJoin: payload => joins.push(payload),
    onSessionUpdate: payload => updates.push(payload),
  });
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  const [, joinRef] = JSON.parse(socket.sent[0]);
  const snapshot = { session: { revision: 5 } };
  try {
    reply(socket, null, snapshot);
    reply(socket, "unknown", snapshot);
    reply(socket, joinRef, snapshot, "ok", "game:OTHER");
    assert.deepEqual(joins, []);
    reply(socket, joinRef, snapshot);
    reply(socket, joinRef, snapshot);
    const pending = subscription.push("player:ready");
    const [, commandRef] = JSON.parse(socket.sent[1]);
    reply(socket, commandRef, snapshot);
    assert.deepEqual(await pending, snapshot);
    reply(socket, commandRef, snapshot);
    assert.deepEqual(joins, [snapshot]);
    assert.deepEqual(updates, []);
    socket.emit("message", { data: JSON.stringify([null, null, "game:TEST01", "session:update", snapshot]) });
    assert.deepEqual(updates, [snapshot]);
    assert.deepEqual(joins, [snapshot]);
  } finally { subscription(); }
});

test("a rejected join cannot later grant join semantics", async () => {
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const joins: unknown[] = [];
  const subscription = subscribeToPhoenixTopic({ topic: "game:TEST01", onJoin: payload => joins.push(payload) });
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  const [, joinRef] = JSON.parse(socket.sent[0]);
  try {
    reply(socket, joinRef, { reason: "not_host" }, "error");
    reply(socket, joinRef, { session: { revision: 5 } });
    assert.deepEqual(joins, []);
  } finally { subscription(); }
});

test("closed connections cannot deliver a delayed join while host-player reconnect keeps its credentials", async () => {
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const joins: unknown[] = [];
  const credentials = { host_token: "test-host", player_id: "test-player", player_token: "test-player-token" };
  const subscription = subscribeToPhoenixTopic({
    topic: "game:TEST01", joinPayload: credentials, onJoin: payload => joins.push(payload),
  });
  const oldSocket = FakeWebSocket.instances.at(-1)!;
  oldSocket.readyState = FakeWebSocket.OPEN;
  oldSocket.emit("open");
  const [, oldRef] = JSON.parse(oldSocket.sent[0]);
  try {
    oldSocket.close();
    oldSocket.emit("close");
    await new Promise(resolve => setTimeout(resolve, 1100));
    const socket = FakeWebSocket.instances.at(-1)!;
    assert.notEqual(socket, oldSocket);
    socket.readyState = FakeWebSocket.OPEN;
    socket.emit("open");
    const [, joinRef, topic, event, payload] = JSON.parse(socket.sent[0]);
    assert.equal(topic, "game:TEST01");
    assert.equal(event, "phx_join");
    assert.deepEqual(payload, credentials);
    assert.notEqual(joinRef, oldRef);
    const snapshot = { session: { revision: 5, private: "host aggregates" } };
    reply(oldSocket, oldRef, snapshot);
    reply(socket, oldRef, snapshot);
    assert.deepEqual(joins, []);
    reply(socket, joinRef, snapshot);
    assert.deepEqual(joins, [snapshot]);
  } finally { subscription(); }
});

test("unsubscribed roles cannot deliver an outstanding join into a new subscription", async () => {
  const { subscribeToPhoenixTopic } = await import("./phoenix-socket");
  const joins: unknown[] = [];
  const old = subscribeToPhoenixTopic({ topic: "game:TEST01", joinPayload: { host_token: "test-host" }, onJoin: p => joins.push(p) });
  const oldSocket = FakeWebSocket.instances.at(-1)!;
  oldSocket.readyState = FakeWebSocket.OPEN;
  oldSocket.emit("open");
  const [, oldRef] = JSON.parse(oldSocket.sent[0]);
  old();
  const player = subscribeToPhoenixTopic({ topic: "game:TEST01", joinPayload: { player_token: "test-player" }, onJoin: p => joins.push(p) });
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  try {
    reply(oldSocket, oldRef, { session: { private: "host aggregates" } });
    assert.deepEqual(joins, []);
    const [, ref, , , payload] = JSON.parse(socket.sent[0]);
    assert.deepEqual(payload, { player_token: "test-player" });
    const snapshot = { session: { revision: 5 } };
    reply(socket, ref, snapshot);
    assert.deepEqual(joins, [snapshot]);
  } finally { player(); }
});
