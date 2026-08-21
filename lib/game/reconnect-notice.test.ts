import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowGameReconnectNotice } from "./reconnect-notice";

test("does not alarm before the first realtime connection has succeeded", () => {
  assert.equal(
    shouldShowGameReconnectNotice({ connected: false, hasConnectedOnce: false, loading: false, gameStatus: "waiting" }),
    false
  );
});

test("alerts after an established realtime connection is lost during a live game", () => {
  assert.equal(
    shouldShowGameReconnectNotice({ connected: false, hasConnectedOnce: true, loading: false, gameStatus: "active" }),
    true
  );
});

test("does not alert after a game has finished", () => {
  assert.equal(
    shouldShowGameReconnectNotice({ connected: false, hasConnectedOnce: true, loading: false, gameStatus: "finished" }),
    false
  );
});
