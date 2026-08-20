import assert from "node:assert/strict";
import test from "node:test";
import { saveQuizDraftV2WithConflictRecovery } from "./quiz-draft-client";

const value = {
  title: "Quiz", category: "Trivia", emoji: "🧠", isPublic: true, sourceType: "manual",
  editingQuizId: null,
  questions: [{
    id: "q1", text: "Question?", type: "multiple_choice" as const, timeLimit: 20, points: 1000,
    videoUrl: "video", shuffleAnswers: true,
    answers: [{ id: "a1", text: "A", isCorrect: true }, { id: "a2", text: "B", isCorrect: false }],
  }],
};

test("draft revision conflict refreshes the server revision and retries the same complete state", async () => {
  const revisions: unknown[] = [];
  const client = {
    async rpc(_name: string, payload: unknown) {
      revisions.push((payload as { p_expected_revision: unknown }).p_expected_revision);
      return revisions.length === 1
        ? { data: null, error: { message: "revision conflict" } }
        : { data: { draft_id: "d1", revision: 10 }, error: null };
    },
    from() {
      return { select: () => ({ eq: () => ({ single: async () => ({ data: { revision: 9 }, error: null }) }) }) };
    },
  };
  const saved = await saveQuizDraftV2WithConflictRecovery({ client, draftId: "d1", expectedRevision: 8, value });
  assert.deepEqual(revisions, [8, 9]);
  assert.deepEqual(saved, { draftId: "d1", revision: 10 });
});
