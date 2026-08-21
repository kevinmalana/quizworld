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
