import assert from "node:assert/strict";
import test from "node:test";

import { shouldDiscardPlayerSession } from "./player-session";

test("temporary reconnect failures preserve the stored player session", () => {
  assert.equal(shouldDiscardPlayerSession(new TypeError("Failed to fetch")), false);
  assert.equal(shouldDiscardPlayerSession(new Error("Request timed out")), false);
});

test("definitive player credential failures discard the stored session", () => {
  assert.equal(shouldDiscardPlayerSession(new Error("Player session is invalid.")), true);
  assert.equal(shouldDiscardPlayerSession(new Error("Player session was not found.")), true);
});
