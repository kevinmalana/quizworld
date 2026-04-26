import test from "node:test";
import assert from "node:assert/strict";

import {
  GAME_PIN_LENGTH,
  sanitizeGamePinInput,
  getGamePinDigits,
  mergeGamePinDigits,
  isCompleteGamePin,
} from "../lib/game-pin.ts";

test("sanitizeGamePinInput uppercases alphanumerics and caps length at six", () => {
  assert.equal(GAME_PIN_LENGTH, 6);
  assert.equal(sanitizeGamePinInput("ab-12!cd34"), "AB12CD");
});

test("getGamePinDigits pads incomplete pins and preserves entered order", () => {
  assert.deepEqual(getGamePinDigits("q9z"), ["Q", "9", "Z", "", "", ""]);
});

test("mergeGamePinDigits distributes pasted or autofilled values from the focused digit", () => {
  assert.deepEqual(mergeGamePinDigits(["", "", "", "", "", ""], "ab-12cd", 0), ["A", "B", "1", "2", "C", "D"]);
  assert.deepEqual(mergeGamePinDigits(["A", "B", "", "", "", ""], "c3d4", 2), ["A", "B", "C", "3", "D", "4"]);
  assert.deepEqual(mergeGamePinDigits(["A", "B", "C", "D", "", ""], "789", 4), ["A", "B", "C", "D", "7", "8"]);
});

test("isCompleteGamePin only accepts fully populated six-character pins", () => {
  assert.equal(isCompleteGamePin("abc123"), true);
  assert.equal(isCompleteGamePin("abc12"), false);
  assert.equal(isCompleteGamePin("abc12!"), false);
});
