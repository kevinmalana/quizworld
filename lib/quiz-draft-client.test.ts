import assert from "node:assert/strict";
import test from "node:test";
import { DraftRevisionConflictError, saveQuizDraftV2WithConflictRecovery } from "./quiz-draft-client";

const value = {
  title: "Quiz", category: "Trivia", emoji: "🧠", isPublic: true, sourceType: "manual",
  editingQuizId: null,
  questions: [{
    id: "q1", text: "Question?", type: "multiple_choice" as const, timeLimit: 20, points: 1000,
    videoUrl: "video", shuffleAnswers: true,
    answers: [{ id: "a1", text: "A", isCorrect: true }, { id: "a2", text: "B", isCorrect: false }],
  }],
};

test("draft revision conflict is surfaced instead of overwriting newer remote work", async () => {
  const revisions: unknown[] = [];
  const client = {
    async rpc(_name: string, payload: unknown) {
      revisions.push((payload as { p_expected_revision: unknown }).p_expected_revision);
      return {
        data: { ok: false, error: "revision_conflict", draft_id: "d1", revision: 9 },
        error: null,
      };
    },
  };

  await assert.rejects(
    saveQuizDraftV2WithConflictRecovery({ client, draftId: "d1", expectedRevision: 8, value }),
    (error: unknown) => error instanceof DraftRevisionConflictError && error.serverRevision === 9,
  );
  assert.deepEqual(revisions, [8]);
});
