import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { choiceFromPayload, ownChoiceFrom, quizOptionView } from "./presentation/own-choice";

test("own choice is recovered from the server's own_response row after a reload", () => {
  assert.equal(ownChoiceFrom({ participant_id: "pp_1", response_data: { answer_id: "a2" } }), "a2");
  assert.equal(ownChoiceFrom({ response_data: { option_id: "o1" } }), "o1");
  assert.equal(ownChoiceFrom({ submitted: true }), null);
  assert.equal(ownChoiceFrom(null), null);
});

test("submitted payloads name the chosen option", () => {
  assert.equal(choiceFromPayload({ answer_id: "a1" }), "a1");
  assert.equal(choiceFromPayload({ option_id: "o2" }), "o2");
  assert.equal(choiceFromPayload({ text: "hello" }), null);
});

test("before the reveal only the participant's own pick is highlighted", () => {
  assert.equal(quizOptionView({ answerId: "a", ownChoice: "a", revealedCorrectIds: undefined }).className, "present-quiz-option is-own");
  assert.equal(quizOptionView({ answerId: "b", ownChoice: "a", revealedCorrectIds: undefined }).mark, null);
});

test("after the reveal a wrong pick is marked on that option only", () => {
  const revealed = ["a"];
  const right = quizOptionView({ answerId: "a", ownChoice: "b", revealedCorrectIds: revealed });
  const mine = quizOptionView({ answerId: "b", ownChoice: "b", revealedCorrectIds: revealed });
  const other = quizOptionView({ answerId: "c", ownChoice: "b", revealedCorrectIds: revealed });
  assert.equal(right.mark, "correct");
  assert.equal(mine.mark, "wrong");
  assert.match(mine.className, /is-own/);
  assert.match(mine.className, /is-wrong/);
  assert.equal(other.mark, null, "options nobody here chose are not marked wrong");
  assert.doesNotMatch(other.className, /is-wrong/);
});

test("a right pick is shown as both correct and yours", () => {
  const v = quizOptionView({ answerId: "a", ownChoice: "a", revealedCorrectIds: ["a"] });
  assert.equal(v.mark, "correct");
  assert.equal(v.isOwn, true);
});

test("both quiz renderers in the live stage use the shared view", () => {
  const src = fs.readFileSync("components/present/live/live-slide-stage.tsx", "utf8");
  assert.equal((src.match(/quizOptionView\(/g) || []).length, 2);
  assert.doesNotMatch(src, /submitted && isRevealed && !isCorrect \? " is-wrong"/);
});
