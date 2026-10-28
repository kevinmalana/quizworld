import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Regressions for the presentation transport defects reproduced by the
// 2026-10-28 audit probes (presentation-transport-probe.cjs). The REAL
// transport module is bundled with esbuild; only the socket-URL provider is
// stubbed. It runs in a vm sandbox with a FakeWebSocket and a virtual clock,
// so reconnect backoff and reply timeouts are deterministic and no real
// network, account or production room is involved.

const socketModulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "presentation-socket.ts");
const TOPIC = "presentation:LOCAL";

type Frame = [string | null, string | null, string, string, unknown];

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static registry: FakeWebSocket[] = [];

  url: string;
  readyState = 0;
  sent: Frame[] = [];
  private listeners = new Map<string, Array<(event: { data?: string }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.registry.push(this);
  }

  addEventListener(kind: string, fn: (event: { data?: string }) => void) {
    (this.listeners.get(kind) ?? this.listeners.set(kind, []).get(kind)!).push(fn);
  }

  send(raw: string) {
    this.sent.push(JSON.parse(raw) as Frame);
  }

  emit(kind: string, event: { data?: string } = {}) {
    for (const fn of this.listeners.get(kind) ?? []) fn(event);
  }

  open() {
    this.readyState = 1;
    this.emit("open");
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }

  reply(ref: string | null, status: "ok" | "error", response: unknown = {}) {
    this.emit("message", { data: JSON.stringify([null, ref, TOPIC, "phx_reply", { status, response }]) });
  }

  push(event: string, payload: unknown, ref: string | null = null) {
    this.emit("message", { data: JSON.stringify([null, ref, TOPIC, event, payload]) });
  }

  frame(event: string): Frame | undefined {
    return this.sent.find((f) => f[3] === event);
  }
}

type VirtualTimer = { id: number; fn: () => void; dueAt: number; every: number | null };

function createHarness() {
  const sockets: FakeWebSocket[] = [];
  FakeWebSocket.registry = sockets;
  const timers = new Map<number, VirtualTimer>();
  let nextId = 1;
  let clock = 0;

  const sandboxWindow = {
    setTimeout: (fn: () => void, delay = 0) => {
      const id = nextId++;
      timers.set(id, { id, fn, dueAt: clock + delay, every: null });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    setInterval: (fn: () => void, delay = 0) => {
      const id = nextId++;
      timers.set(id, { id, fn, dueAt: clock + delay, every: delay || 1 });
      return id;
    },
    clearInterval: (id: number) => {
      timers.delete(id);
    },
  };

  const advance = (ms: number) => {
    const target = clock + ms;
    for (;;) {
      const due = [...timers.values()].filter((t) => t.dueAt <= target).sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];
      if (!due) break;
      clock = Math.max(clock, due.dueAt);
      if (due.every === null) timers.delete(due.id);
      else due.dueAt += due.every;
      due.fn();
    }
    clock = target;
  };

  return {
    sockets,
    timers,
    advance,
    sandboxWindow,
    reconnectDelayTimerCount: () => [...timers.values()].filter((t) => t.every === null).length,
    heartbeatTimerCount: () => [...timers.values()].filter((t) => t.every === 30000).length,
  };
}

const bundlePromise = build({
  entryPoints: [socketModulePath],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  plugins: [{
    name: "local-game-client-stub",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/game-engine\/client$/ }, () => ({ path: "game-client-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `export function getGameServiceSocketUrl(){return "ws://presentation-local";}`,
        loader: "js",
      }));
    },
  }],
});

type RecordedCallbacks = {
  joined: number;
  disconnected: string[];
  closed: number;
  errors: string[];
  updates: unknown[];
};

type Channel = {
  nextSlide: () => Promise<unknown>;
  prevSlide: () => Promise<unknown>;
  gotoSlide: (index: number) => Promise<unknown>;
  setResultsHidden: (hidden: boolean) => Promise<unknown>;
  submitResponse: (slideId: string, data: Record<string, unknown>, name: string) => Promise<unknown>;
  endPresentation: () => Promise<unknown>;
  disconnect: () => void;
};

async function loadChannel(): Promise<{ h: ReturnType<typeof createHarness>; channel: Channel; cb: RecordedCallbacks }> {
  const h = createHarness();
  const bundle = await bundlePromise;
  const mod = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module: mod,
    exports: mod.exports,
    require: () => {
      throw new Error("unexpected require in bundled transport");
    },
    WebSocket: FakeWebSocket,
    console,
    window: h.sandboxWindow,
  });

  const cb: RecordedCallbacks = { joined: 0, disconnected: [], closed: 0, errors: [], updates: [] };
  const subscribe = mod.exports.subscribeToPresentation as (o: unknown) => Channel;
  const channel = subscribe({
    presentationId: "LOCAL",
    presenterToken: "local-fixture-token",
    callbacks: {
      onJoined: () => { cb.joined += 1; },
      onDisconnected: (message: string) => { cb.disconnected.push(message); },
      onClose: () => { cb.closed += 1; },
      onError: (message: string) => { cb.errors.push(message); },
      onPresentationUpdate: (presentation: unknown) => { cb.updates.push(presentation); },
    },
  });
  return { h, channel, cb };
}

function completeJoin(socket: FakeWebSocket) {
  const join = socket.frame("phx_join");
  assert.ok(join, "phx_join frame was sent");
  socket.reply(join[1], "ok", {});
}

test("transport: a silent half-open socket is detected by bounded heartbeat acknowledgment", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0]; socket.open(); completeJoin(socket);
  h.advance(30_000);
  assert.ok(socket.frame("heartbeat"));
  h.advance(8_001);
  await Promise.resolve();
  assert.equal(cb.disconnected.length, 1);
  assert.equal(socket.readyState, FakeWebSocket.CLOSED);
  channel.disconnect();
  assert.equal(h.timers.size, 0);
});

test("transport: heartbeat replies are correlated to the phoenix topic", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0]; socket.open(); completeJoin(socket);
  h.advance(30_000);
  const ref = socket.frame("heartbeat")![1];
  socket.emit("message", { data: JSON.stringify([null, ref, "phoenix", "phx_reply", {status:"ok",response:{}}]) });
  h.advance(8_001);
  await Promise.resolve();
  assert.equal(cb.disconnected.length, 0);
  channel.disconnect();
});

test("transport: an already queued old heartbeat cannot write on the new socket", async () => {
  const { h, channel } = await loadChannel();
  h.sockets[0].open(); completeJoin(h.sockets[0]);
  const queuedHeartbeat = [...h.timers.values()].find(timer => timer.every === 30_000)!.fn;
  h.sockets[0].close(); h.advance(1_000);
  const next = h.sockets[1]; next.open(); completeJoin(next);
  const before = next.sent.length;
  queuedHeartbeat();
  assert.equal(next.sent.length, before);
  channel.disconnect();
});

async function raceSettled(p: Promise<unknown>): Promise<unknown> {
  return Promise.race([p, new Promise((resolve) => setTimeout(() => resolve({ status: "still-pending" }), 300))]);
}

test("transport: pre-join commands are rejected without writing a mutation frame", async () => {
  const { h, channel } = await loadChannel();
  h.sockets[0].open();
  assert.equal((await channel.nextSlide() as {status:string}).status, "rejected");
  assert.equal(h.sockets[0].sent.length, 1);
  channel.disconnect();
});

test("transport: timed-out join cannot later join or apply stale state", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0];
  socket.open();
  const ref = socket.frame("phx_join")![1];
  h.advance(8_001);
  socket.reply(ref, "ok", { presentation: { title: "expired join" } });
  assert.equal(cb.joined, 0);
  assert.equal(cb.updates.length, 0);
  await Promise.resolve();
  assert.equal(cb.errors.length, 1);
  assert.equal(cb.disconnected.length, 1);
  channel.disconnect();
});

test("transport: close fences messages immediately, before reconnect starts", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0];
  socket.open(); completeJoin(socket); socket.close();
  socket.push("presentation:update", { presentation: { title: "closed socket" } });
  assert.equal(cb.updates.length, 0);
  channel.disconnect();
});

test("transport: reconnect never replays an uncertain mutation; old join refs and duplicate replies are ignored", async () => {
  const { h, channel, cb } = await loadChannel();
  const old = h.sockets[0];
  old.open(); completeJoin(old);
  const oldJoinRef = old.frame("phx_join")![1];
  const pending = channel.nextSlide();
  old.close();
  assert.equal((await pending as {status:string}).status, "uncertain");
  h.advance(1_000);
  const next = h.sockets[1]; next.open();
  next.reply(oldJoinRef, "ok", { presentation: { title: "wrong join generation" } });
  assert.equal(cb.joined, 1);
  assert.equal(cb.updates.length, 0);
  completeJoin(next); completeJoin(next);
  assert.equal(cb.joined, 2);
  h.advance(60_000);
  assert.equal(next.sent.filter(frame => frame[3] === "slide:next").length, 0);
  channel.disconnect();
  assert.equal(h.timers.size, 0);
});

test("transport: late command replies cannot roll back a newer authoritative broadcast", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0]; socket.open(); completeJoin(socket);
  const pending = channel.nextSlide();
  const commandRef = socket.frame("slide:next")![1];
  socket.push("presentation:update", { presentation: { current_slide_index: 2 } });
  socket.reply(commandRef, "ok", { presentation: { current_slide_index: 1 } });
  assert.equal((await pending as {status:string}).status, "confirmed");
  assert.equal(cb.updates.length, 1);
  assert.equal((cb.updates[0] as {current_slide_index:number}).current_slide_index, 2);
  socket.reply(commandRef, "ok", { presentation: { current_slide_index: 0 } });
  assert.equal(cb.updates.length, 1);
  channel.disconnect();
});

test("transport: expired mutation reply is ignored, including its snapshot", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0]; socket.open(); completeJoin(socket);
  const pending = channel.nextSlide();
  const ref = socket.frame("slide:next")![1];
  h.advance(8_001);
  assert.equal((await pending as {status:string}).status, "uncertain");
  socket.reply(ref, "ok", { presentation: { title: "late" } });
  assert.equal(cb.updates.length, 0);
  channel.disconnect();
});

test("transport: explicit cleanup settles sent commands as uncertain and fences callbacks", async () => {
  const { h, channel, cb } = await loadChannel();
  const socket = h.sockets[0]; socket.open(); completeJoin(socket);
  const pending = channel.nextSlide();
  channel.disconnect();
  assert.equal((await pending as {status:string}).status, "uncertain");
  socket.push("presentation:update", { presentation: { title: "late" } });
  assert.equal(cb.updates.length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal((await channel.nextSlide() as {status:string}).status, "rejected");
});

test("transport: unintentional close signals onDisconnected immediately and keeps reconnect scheduled", async () => {
  const { h, channel, cb } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);
    assert.equal(cb.joined, 1);
    assert.equal(cb.disconnected.length, 0);

    h.sockets[0].close();

    // F1: the disconnect must be observable immediately, not only after the
    // 8th failed reconnect attempt.
    assert.equal(cb.disconnected.length, 1);
    assert.equal(cb.closed, 0);
    assert.ok(h.reconnectDelayTimerCount() > 0, "reconnect backoff is scheduled");
  } finally {
    channel.disconnect();
  }
});

test("transport: command issued while disconnected is explicitly rejected, never a silent false", async () => {
  const { h, channel } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);
    h.sockets[0].close();

    const outcome = await channel.nextSlide();
    assert.deepEqual(Object.keys(outcome as object).sort(), ["reason", "status"]);
    assert.equal((outcome as { status: string }).status, "rejected");
    assert.match(String((outcome as { reason: string }).reason), /not connected/i);
  } finally {
    channel.disconnect();
  }
});

test("transport: in-flight command settles as uncertain when the connection drops", async () => {
  const { h, channel } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);

    const pending = channel.gotoSlide(2);
    // No reply yet — the socket dies first. The command must settle promptly
    // as uncertain (never auto-replayed), not hang until the reply timeout.
    h.sockets[0].close();

    const outcome = await raceSettled(pending);
    assert.notEqual(outcome, { status: "still-pending" });
    assert.equal((outcome as { status: string }).status, "uncertain");
    assert.match(String((outcome as { reason: string }).reason), /connection lost/i);
  } finally {
    channel.disconnect();
  }
});

test("transport: unanswered command settles as uncertain after the reply timeout", async () => {
  const { h, channel } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);

    const pending = channel.setResultsHidden(true);
    h.advance(8_100);

    const outcome = await pending;
    assert.equal((outcome as { status: string }).status, "uncertain");
    assert.match(String((outcome as { reason: string }).reason), /no reply/i);
  } finally {
    channel.disconnect();
  }
});

test("transport: server error reply settles the command as rejected with the server reason and keeps the channel joined", async () => {
  const { h, channel, cb } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);

    const pending = channel.submitResponse("slide-1", { text: "answer" }, "Local Player");
    const push = h.sockets[0].sent[h.sockets[0].sent.length - 1];
    h.sockets[0].reply(push[1], "error", { reason: "participant token invalid" });

    const outcome = await pending;
    assert.equal((outcome as { status: string }).status, "rejected");
    assert.match(String((outcome as { reason: string }).reason), /participant token invalid/i);
    // A command-level server rejection is not a channel-level error: the
    // connection itself is still joined.
    assert.equal(cb.errors.length, 0);
  } finally {
    channel.disconnect();
  }
});

test("transport: a superseded socket generation cannot publish after reconnection", async () => {
  const { h, channel, cb } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);
    h.sockets[0].close();
    h.advance(1_000);

    assert.equal(h.sockets.length, 2, "reconnect attempt created a new socket");
    h.sockets[1].open();
    completeJoin(h.sockets[1]);
    assert.equal(cb.joined, 2);

    // Injected race from the audit probe: the OLD socket delivers an event
    // after the new connection is live. It must be fenced out.
    h.sockets[0].push("presentation:update", { presentation: { title: "stale-old-socket-update" } });
    assert.equal(cb.updates.length, 0);
  } finally {
    channel.disconnect();
  }
});

test("transport: a stale close event cannot schedule reconnects or clear the live connection heartbeat", async () => {
  const { h, channel } = await loadChannel();
  try {
    h.sockets[0].open();
    completeJoin(h.sockets[0]);
    h.sockets[0].close();
    h.advance(1_000);
    h.sockets[1].open();
    completeJoin(h.sockets[1]);
    assert.equal(h.heartbeatTimerCount(), 1, "live connection heartbeat is running");

    // The old socket reports a late close AFTER the new connection is live.
    h.sockets[0].close();

    assert.equal(h.heartbeatTimerCount(), 1, "stale close must not clear the new heartbeat");
    h.advance(32_000);
    assert.equal(h.sockets.length, 2, "stale close must not spawn extra connections");
  } finally {
    channel.disconnect();
  }
});

test("transport: join and state replies are correlated to refs this connection actually sent", async () => {
  const { h, channel, cb } = await loadChannel();
  try {
    h.sockets[0].open();
    const join = h.sockets[0].frame("phx_join");
    assert.ok(join, "phx_join frame was sent");

    // A reply carrying a ref we never sent must be ignored entirely, even if
    // it looks successful and carries presentation state.
    h.sockets[0].reply("999", "ok", { presentation: { title: "fabricated-state" } });
    assert.equal(cb.joined, 0);
    assert.equal(cb.updates.length, 0);

    // The reply correlated to the actual phx_join ref joins the channel.
    h.sockets[0].reply(join[1], "ok", {});
    assert.equal(cb.joined, 1);
  } finally {
    channel.disconnect();
  }
});
