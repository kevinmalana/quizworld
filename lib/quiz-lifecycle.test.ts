import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDraftFingerprint,
  buildDraftSavePayload,
  getDraftContinueHref,
  getQuizLifecycleIntent,
  normalizePublishResult,
  recoverLocalDraft,
} from "./quiz-lifecycle";

const completeQuestion = {
  id: "question-1",
  text: "What is the capital of France?",
  type: "multiple_choice" as const,
  timeLimit: 30,
  points: 1000,
  imageUrl: "https://example.com/question.png",
  videoUrl: "https://example.com/video",
  shuffleAnswers: true,
  explanation: "Paris is the capital city of France.",
  aiMetadata: {
    confidence: "high" as const,
    difficulty: "easy" as const,
    rationale: "Grounded in the source.",
    citations: [{ source_label: "Source", snippet: "Paris is the capital city of France." }],
  },
  answers: [
    { id: "answer-1", text: "Paris", isCorrect: true },
    { id: "answer-2", text: "Lyon", isCorrect: false },
  ],
};

test("quiz lifecycle gives draft recovery precedence and preserves duplicate intent", () => {
  assert.deepEqual(
    getQuizLifecycleIntent(new URLSearchParams("draft=draft-1&quiz=quiz-1&version=version-1&duplicate=1")),
    { kind: "draft", id: "draft-1" },
  );
  assert.deepEqual(
    getQuizLifecycleIntent(new URLSearchParams("quiz=quiz-1&duplicate=1")),
    { kind: "duplicate", id: "quiz-1" },
  );
  assert.deepEqual(
    getQuizLifecycleIntent(new URLSearchParams("version=version-1")),
    { kind: "version", id: "version-1" },
  );
});

test("dashboard draft action opens the recoverable draft", () => {
  assert.equal(getDraftContinueHref("draft id/1"), "/create?draft=draft%20id%2F1");
});

test("publish results normalize both create UUIDs and republish metadata", () => {
  assert.deepEqual(normalizePublishResult("new-quiz", null), {
    quizId: "new-quiz",
    versionNumber: null,
    lifecycle: "created",
  });
  assert.deepEqual(
    normalizePublishResult({ quiz_id: "quiz-1", version_number: 4 }, "quiz-1"),
    { quizId: "quiz-1", versionNumber: 4, lifecycle: "updated" },
  );
  assert.throws(
    () => normalizePublishResult({ version_number: 4 }, "quiz-1"),
    /quiz id/i,
  );
});

test("draft fingerprints include persistence-relevant metadata", () => {
  const base = {
    title: "Capitals",
    category: "Geography",
    emoji: "🌍",
    isPublic: true,
    sourceType: "manual",
    editingQuizId: null,
    questions: [completeQuestion],
  };

  const original = buildDraftFingerprint(base);
  assert.notEqual(buildDraftFingerprint({ ...base, isPublic: false }), original);
  assert.notEqual(
    buildDraftFingerprint({ ...base, questions: [{ ...completeQuestion, points: 2000 }] }),
    original,
  );
  assert.notEqual(
    buildDraftFingerprint({ ...base, questions: [{ ...completeQuestion, explanation: "Changed" }] }),
    original,
  );
  assert.notEqual(
    buildDraftFingerprint({ ...base, questions: [{ ...completeQuestion, shuffleAnswers: false }] }),
    original,
  );
  assert.notEqual(
    buildDraftFingerprint({
      ...base,
      questions: [{ ...completeQuestion, aiMetadata: { ...completeQuestion.aiMetadata, confidence: "low" } }],
    }),
    original,
  );
});

test("atomic draft payload preserves question and answer authoring fields", () => {
  assert.deepEqual(
    buildDraftSavePayload({
      draftId: "draft-1",
      quizId: "quiz-1",
      title: "Capitals",
      category: "Geography",
      emoji: "🌍",
      color: "",
      isPublic: false,
      sourceType: "manual",
      expectedRevision: 7,
      questions: [completeQuestion],
    }),
    {
      p_draft_id: "draft-1",
      p_expected_revision: 7,
      p_quiz_id: "quiz-1",
      p_title: "Capitals",
      p_category: "Geography",
      p_emoji: "🌍",
      p_color: "",
      p_is_public: false,
      p_source_type: "manual",
      p_questions: [
        {
          text: "What is the capital of France?",
          image_url: "https://example.com/question.png",
          video_url: "https://example.com/video",
          shuffle_answers: true,
          time_limit: 30,
          points: 1000,
          order_index: 0,
          question_type: "multiple_choice",
          explanation: "Paris is the capital city of France.",
          ai_metadata: {
            confidence: "high",
            difficulty: "easy",
            rationale: "Grounded in the source.",
            citations: [{ source_label: "Source", snippet: "Paris is the capital city of France." }],
          },
          answers: [
            { text: "Paris", image_url: null, is_correct: true, order_index: 0 },
            { text: "Lyon", image_url: null, is_correct: false, order_index: 1 },
          ],
        },
      ],
    },
  );
});

test("local draft recovery accepts valid authoring state and rejects corrupt storage", () => {
  const raw = JSON.stringify({
    title: "Recovered quiz",
    category: "Trivia",
    emoji: "🧠",
    isPublic: true,
    sourceType: "manual",
    questions: [completeQuestion],
  });
  assert.equal(recoverLocalDraft(raw)?.title, "Recovered quiz");
  assert.equal(recoverLocalDraft("not-json"), null);
  assert.equal(recoverLocalDraft(JSON.stringify({ title: "No questions" })), null);
});
