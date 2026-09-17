// Real isolated Phoenix protocol acceptance; deliberately not part of default unit suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LiveGame } from "../src/live";
import { createLiveTransport } from "../src/live-transport";
import { nativeWebSocket } from "../src/native-websocket";
import { WebSocket as NodeWebSocket } from "ws";
const base = "http://127.0.0.1:4187";
const credentials = JSON.parse(
  readFileSync("/tmp/quizworld-mobile-fixture.json", "utf8"),
);
async function host(action: string) {
  const res = await fetch(`${base}/api/sessions/APP001/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_token: credentials.APP001 }),
  });
  assert.equal(res.status, 200);
  return res.json();
}
async function waitFor(fn: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!fn()) {
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for server state");
    await new Promise((r) => setTimeout(r, 30));
  }
}
test("real Phoenix rejects missing, closed and full games without creating a player identity", async () => {
  for (const [pin, message] of [
    ["BAD001", /not found/],
    ["APP003", /not accepting/],
    ["FULL01", /full/],
  ] as const) {
    const game = new LiveGame(
      createLiveTransport(base),
      {
        save: async () => {
          throw new Error("Unexpected saved identity");
        },
        clear: async () => {},
      },
      () => {},
    );
    await game.join(pin, "Rejected fixture");
    assert.equal(game.state.playerId, null);
    assert.match(game.state.error, message);
    game.dispose();
  }
});
test("real Phoenix join, ready, answer, reconnect, reveal and final result", async () => {
  let nativeConnections = 0;
  const NativeSocket = nativeWebSocket(
    NodeWebSocket as unknown as typeof WebSocket,
  );
  class ObservedNativeSocket extends NativeSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      nativeConnections++;
    }
  }
  const game = new LiveGame(
    createLiveTransport(base, ObservedNativeSocket),
    { save: async () => {}, clear: async () => {} },
    () => {},
  );
  try {
    await game.join("APP001", "Native protocol fixture");
    assert.equal(game.state.error, "");
    await waitFor(() => game.state.connected);
    assert.ok(
      nativeConnections > 0,
      "must exercise the native Origin adapter, not Node default",
    );
    assert.equal(game.state.session?.status, "waiting");
    await game.ready();
    assert.ok(
      game.state.session?.ready_player_ids?.includes(game.state.playerId!),
    );
    await host("start");
    await waitFor(() => game.state.session?.status === "active");
    assert.equal(
      game.state.session?.current_question?.answers[0].is_correct,
      undefined,
    );
    await game.answer("a1");
    await waitFor(() => game.state.session?.status === "reveal");
    assert.equal(game.state.session?.current_answers?.[0].is_correct, true);
    game.suspend();
    await game.resume();
    await waitFor(() => game.state.connected);
    assert.equal(game.state.session?.current_answers?.[0].is_correct, true);
    await host("advance");
    await waitFor(() => game.state.session?.current_question?.id === "q2");
    await game.answer("b2");
    await waitFor(() => game.state.session?.status === "reveal");
    assert.equal(game.state.session?.current_answers?.[0].is_correct, false);
    await host("advance");
    await waitFor(() => game.state.session?.status === "finished");
    assert.equal(game.state.connected, false);
    assert.ok(
      game.state.session!.players.find((p) => p.id === game.state.playerId)!
        .score > 0,
    );
  } finally {
    game.dispose();
  }
});
