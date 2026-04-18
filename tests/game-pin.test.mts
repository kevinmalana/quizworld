import test from "node:test";
import assert from "node:assert/strict";

import {
  GAME_PIN_LENGTH,
  sanitizeGamePinInput,
  getGamePinDigits,
  isCompleteGamePin,
} from "../lib/game-pin.ts";

test("sanitizeGamePinInput uppercases alphanumerics and caps length at six", () => {
  assert.equal(GAME_PIN_LENGTH, 6);
  assert.equal(sanitizeGamePinInput("ab-12!cd34"), "AB12CD");
});

test("getGamePinDigits pads incomplete pins and preserves entered order", () => {
  assert.deepEqual(getGamePinDigits("q9z"), ["Q", "9", "Z", "", "", ""]);
});

test("isCompleteGamePin only accepts fully populated six-character pins", () => {
  assert.equal(isCompleteGamePin("abc123"), true);
  assert.equal(isCompleteGamePin("abc12"), false);
  assert.equal(isCompleteGamePin("abc12!"), false);
});
