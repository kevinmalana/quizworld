"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { QuestionData } from "@/components/builder/QuestionCard";
import type { SourceType } from "@/components/builder/SourcePicker";
import {
  questionsFromDraftRows,
  questionsFromPublishedQuiz,
  questionsFromVersionSnapshot,
  type PublishedQuizRow,
  type QuizDraftAnswerRow,
  type QuizDraftQuestionRow,
  type QuizDraftRow,
  type QuizVersionRow,
} from "@/lib/quiz-drafts";
import {
  getLifecycleHref,
  getQuizLifecycleIntent,
  recoverLocalDraft,
  type QuizLifecycleIntent,
} from "@/lib/quiz-lifecycle";

export type RecoveredQuizAuthoringState = {
  remoteDraftId: string | null;
  editingQuizId: string | null;
  title: string;
  category: string;
  emoji: string;
  isPublic: boolean;
  sourceType: SourceType;
  questions: QuestionData[];
  draftState: "idle" | "dirty" | "saved";
  markAsSaved: boolean;
};

type CurrentDraft = {
  title: string;
  category: string;
  emoji: string;
  isPublic: boolean;
  sourceType: SourceType;
  questions: QuestionData[];
};

type Options = {
  authLoading: boolean;
  userId: string | null;
  draftParam: string | null;
  quizParam: string | null;
  versionParam: string | null;
  duplicateParam: boolean;
  router: { push(href: string): void };
  storageKey: string;
  currentDraft: CurrentDraft;
  makeBlankQuestion: () => QuestionData;
  onRecover: (state: RecoveredQuizAuthoringState) => void;
  onLoadError: (message: string) => void;
};

export function useQuizAuthoringRecovery(options: Options): void {
  const {
    authLoading,
    userId,
    draftParam,
    quizParam,
    versionParam,
    duplicateParam,
    router,
    storageKey,
    currentDraft,
    makeBlankQuestion,
    onRecover,
    onLoadError,
  } = options;

  useEffect(() => {
    const intent = getIntent(draftParam, quizParam, versionParam, duplicateParam);
    if (intent.kind === "new" || authLoading) return;
    if (!userId) {
      sessionStorage.setItem("qw_post_login_redirect", getLifecycleHref(intent));
      router.push("/login");
      return;
    }
    const remoteUserId = userId;
    const remoteIntent = intent as Exclude<QuizLifecycleIntent, { kind: "new" }>;

    let ignore = false;
    async function load() {
      onLoadError("");
      try {
        const recovered = await loadRemoteAuthoringState(remoteIntent, remoteUserId, makeBlankQuestion);
        if (!ignore) onRecover(recovered);
      } catch (error) {
        if (!ignore) onLoadError(error instanceof Error ? error.message : "Could not load this quiz.");
      }
    }
    void load();
    return () => { ignore = true; };
  }, [authLoading, draftParam, duplicateParam, makeBlankQuestion, onLoadError, onRecover, quizParam, router, userId, versionParam]);

  useEffect(() => {
    if (draftParam || quizParam || versionParam) return;
    const recovered = recoverLocalDraft(sessionStorage.getItem(storageKey));
    if (!recovered) return;
    onRecover({
      remoteDraftId: null,
      editingQuizId: null,
      ...recovered,
      sourceType: recovered.sourceType as SourceType,
      draftState: "dirty",
      markAsSaved: false,
    });
  }, [draftParam, onRecover, quizParam, storageKey, versionParam]);

  useEffect(() => {
    const hasContent = Boolean(
      currentDraft.title.trim() ||
      currentDraft.questions.length > 1 ||
      currentDraft.questions.some((question) =>
        question.text.trim() || question.answers.some((answer) => answer.text.trim())
      )
    );
    if (!hasContent) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(currentDraft));
    } catch {
      // Storage may be unavailable in hardened/private browsing contexts.
    }
  }, [currentDraft, storageKey]);
}

function getIntent(
  draftParam: string | null,
  quizParam: string | null,
  versionParam: string | null,
  duplicateParam: boolean,
): QuizLifecycleIntent {
  return getQuizLifecycleIntent(new URLSearchParams({
    ...(draftParam ? { draft: draftParam } : {}),
    ...(quizParam ? { quiz: quizParam } : {}),
    ...(versionParam ? { version: versionParam } : {}),
    ...(duplicateParam ? { duplicate: "1" } : {}),
  }));
}

async function loadRemoteAuthoringState(
  intent: Exclude<QuizLifecycleIntent, { kind: "new" }>,
  userId: string,
  makeBlankQuestion: () => QuestionData,
): Promise<RecoveredQuizAuthoringState> {
  if (intent.kind === "draft") {
    const { data: draft, error: draftError } = await supabase
      .from("quiz_drafts")
      .select("id,quiz_id,title,category,emoji,color,is_public,source_type,updated_at")
      .eq("id", intent.id)
      .eq("owner_id", userId)
      .single();
    if (draftError) throw draftError;
    const { data: draftQuestions, error: questionsError } = await supabase
      .from("quiz_draft_questions")
      .select("id,draft_id,text,image_url,time_limit,points,order_index,question_type,explanation")
      .eq("draft_id", intent.id)
      .order("order_index", { ascending: true });
    if (questionsError) throw questionsError;
    const questionIds = (draftQuestions ?? []).map((question) => question.id);
    const answerResult = questionIds.length > 0
      ? await supabase
          .from("quiz_draft_answers")
          .select("id,question_id,text,image_url,is_correct,order_index")
          .in("question_id", questionIds)
          .order("order_index", { ascending: true })
      : { data: [], error: null };
    if (answerResult.error) throw answerResult.error;

    const row = draft as QuizDraftRow;
    return recoveredState({
      remoteDraftId: row.id,
      editingQuizId: row.quiz_id,
      title: row.title ?? "",
      category: row.category ?? "General Knowledge",
      emoji: row.emoji ?? "💡",
      isPublic: row.is_public ?? true,
      sourceType: row.source_type as SourceType,
      questions: questionsFromDraftRows(
        (draftQuestions as QuizDraftQuestionRow[]) ?? [],
        (answerResult.data as QuizDraftAnswerRow[]) ?? [],
      ) as QuestionData[],
      draftState: "saved",
      markAsSaved: true,
    }, makeBlankQuestion);
  }

  if (intent.kind === "edit" || intent.kind === "duplicate") {
    const { data: quiz, error } = await supabase
      .from("quizzes")
      .select("id,title,category,emoji,color,is_public,questions(id,text,image_url,time_limit,points,order_index,question_type,explanation,answers(id,text,image_url,is_correct,order_index))")
      .eq("id", intent.id)
      .eq("creator_id", userId)
      .single();
    if (error) throw error;
    const row = quiz as PublishedQuizRow;
    const duplicate = intent.kind === "duplicate";
    return recoveredState({
      remoteDraftId: null,
      editingQuizId: duplicate ? null : row.id,
      title: duplicate ? `${row.title || "Untitled Quiz"} Copy` : row.title ?? "",
      category: row.category ?? "General Knowledge",
      emoji: row.emoji ?? "💡",
      isPublic: row.is_public ?? true,
      sourceType: "manual",
      questions: questionsFromPublishedQuiz(row) as QuestionData[],
      draftState: "idle",
      markAsSaved: true,
    }, makeBlankQuestion);
  }

  const { data: version, error } = await supabase
    .from("quiz_versions")
    .select("id,quiz_id,creator_id,version_number,title,category,emoji,color,is_public,snapshot,created_at")
    .eq("id", intent.id)
    .eq("creator_id", userId)
    .single();
  if (error) throw error;
  const row = version as QuizVersionRow;
  return recoveredState({
    remoteDraftId: null,
    editingQuizId: row.quiz_id,
    title: row.snapshot.title ?? row.title ?? "",
    category: row.snapshot.category ?? row.category ?? "General Knowledge",
    emoji: row.snapshot.emoji ?? row.emoji ?? "💡",
    isPublic: row.snapshot.is_public ?? row.is_public ?? true,
    sourceType: "manual",
    questions: questionsFromVersionSnapshot(row) as QuestionData[],
    draftState: "idle",
    markAsSaved: true,
  }, makeBlankQuestion);
}

function recoveredState(
  state: RecoveredQuizAuthoringState,
  makeBlankQuestion: () => QuestionData,
): RecoveredQuizAuthoringState {
  return {
    ...state,
    questions: state.questions.length > 0 ? state.questions : [makeBlankQuestion()],
  };
}
