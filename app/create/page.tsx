"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { uid } from "@/lib/shared";
import { parseImportedQuestions } from "@/lib/quiz-import";
import type { AIGenerationOptions } from "@/lib/quiz-ai";
import { DEFAULT_AI_OPTIONS } from "@/lib/quiz-ai";
import { SourcePicker, type SourceType } from "@/components/builder/SourcePicker";
import { type QuestionData } from "@/components/builder/QuestionCard";
import { BuilderWorkspace, type DraftSyncState } from "@/components/builder/BuilderWorkspace";
import { CreateSourceModals, type AIQuestionCount } from "@/components/builder/CreateSourceModals";
import { PublishLoginPrompt } from "@/components/builder/PublishLoginPrompt";
import {
  aiDraftToQuestionData,
  canPublishQuiz,
  isQuestionComplete,
  legacyToQuestionData,
  makeBlankQuestion,
  makeTrueFalseQuestion,
  questionsToPublishPayload,
} from "@/lib/builder/question-factory";
import {
  buildDraftFingerprint,
  getLifecycleHref,
  getQuizLifecycleIntent,
  normalizePublishResult,
} from "@/lib/quiz-lifecycle";
import { useQuizAuthoringRecovery, type RecoveredQuizAuthoringState } from "@/lib/builder/use-quiz-authoring-recovery";
import { useSerializedAutosave } from "@/lib/autosave/use-serialized-autosave";
import { DraftRevisionConflictError, saveQuizDraftV2WithConflictRecovery, type DraftClient } from "@/lib/quiz-draft-client";

type PageStep = "source" | "builder";
const CREATE_DRAFT_KEY = "qw_create_draft_v9";
function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const draftParam = searchParams.get("draft");
  const quizParam = searchParams.get("quiz");
  const versionParam = searchParams.get("version");
  const duplicateParam = searchParams.get("duplicate") === "1";
  const studyPurpose = searchParams.get("purpose") === "study";
  const sourceParam = searchParams.get("source");
  const initialSourceType: SourceType = sourceParam === "document" ? "ai-document" : sourceParam === "url" ? "ai-url" : sourceParam === "topic" || sourceParam === "template" ? "ai-topic" : "manual";

  const [step, setStep] = useState<PageStep>("source");
  const [sourceType, setSourceType] = useState<SourceType>(initialSourceType);
  const [questions, setQuestions] = useState<QuestionData[]>([makeBlankQuestion()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizCategory, setQuizCategory] = useState("General Knowledge");
  const [quizEmoji, setQuizEmoji] = useState("💡");
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const [remoteDraftId, setRemoteDraftId] = useState<string | null>(null);
  const [, setRemoteRevision] = useState<number | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftSyncState>("idle");
  const [loadError, setLoadError] = useState("");
  const lastSavedFingerprint = useRef<string>("");
  const remoteDraftIdRef = useRef<string | null>(null);
  const remoteRevisionRef = useRef<number | null>(null);

  const [aiTopic, setAiTopic] = useState(sourceParam === "template" ? "Educational quiz covering key concepts, definitions, and important facts" : "");
  const [aiUrl, setAiUrl] = useState("");
  const [aiCount, setAiCount] = useState<AIQuestionCount>(10);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [aiOptions, setAiOptions] = useState<AIGenerationOptions>(DEFAULT_AI_OPTIONS);

  const applyRecoveredState = useCallback((state: RecoveredQuizAuthoringState) => {
    setRemoteDraftId(state.remoteDraftId);
    remoteDraftIdRef.current = state.remoteDraftId;
    setRemoteRevision(state.revision);
    remoteRevisionRef.current = state.revision;
    setEditingQuizId(state.editingQuizId);
    setQuizTitle(state.title);
    setQuizCategory(state.category);
    setQuizEmoji(state.emoji);
    setIsPublic(state.isPublic);
    setSourceType(state.sourceType);
    setQuestions(state.questions);
    setActiveIndex(0);
    setStep("builder");
    setDraftState(state.draftState);
    lastSavedFingerprint.current = state.markAsSaved
      ? buildDraftFingerprint({ ...state, editingQuizId: state.editingQuizId })
      : "";
  }, []);

  useQuizAuthoringRecovery({
    authLoading, userId: user?.id ?? null,
    draftParam, quizParam, versionParam, duplicateParam, router,
    storageKey: CREATE_DRAFT_KEY,
    currentRemoteDraftId: remoteDraftId,
    currentDraft: { title: quizTitle, category: quizCategory, emoji: quizEmoji, isPublic, sourceType, questions },
    makeBlankQuestion, onRecover: applyRecoveredState, onLoadError: setLoadError,
  });

  const readyCount = questions.filter(isQuestionComplete).length;
  const canPublish = canPublishQuiz(quizTitle, questions);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = sessionStorage.getItem("qw_pending_publish");
      if (saved) {
        const data = JSON.parse(saved);
        sessionStorage.removeItem("qw_pending_publish");
        if (data.quizTitle) setQuizTitle(data.quizTitle);
        if (data.quizCategory) setQuizCategory(data.quizCategory);
        if (data.quizEmoji) setQuizEmoji(data.quizEmoji);
        if (data.isPublic !== undefined) setIsPublic(data.isPublic);
        if (data.questions?.length) { setQuestions(data.questions); setActiveIndex(0); }
        if (data.editingQuizId) setEditingQuizId(data.editingQuizId);
        setStep("builder");
      }
    } catch {}
  }, [user]);

  const addQuestion = useCallback(() => {
    const q = makeBlankQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
    setDraftState("dirty");
  }, [questions.length]);

  const addTrueFalse = useCallback(() => {
    const q = makeTrueFalseQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
    setDraftState("dirty");
  }, [questions.length]);

  const updateQuestion = useCallback((idx: number, q: QuestionData) => {
    // Smart defaults (#10): auto-detect T/F from question text
    let updated = q;
    if (q.type === "multiple_choice") {
      const lower = q.text.toLowerCase().trim();
      if (lower.startsWith("true or false") || lower.startsWith("true/false") || lower.startsWith("is it true") || lower.startsWith("is this true")) {
        updated = { ...q, type: "true_false", answers: [
          { id: uid(), text: "True", isCorrect: true },
          { id: uid(), text: "False", isCorrect: false },
        ] };
      }
    }
    setQuestions((prev) => prev.map((p, i) => (i === idx ? updated : p)));
    setDraftState("dirty");
  }, []);

  const deleteQuestion = useCallback((idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setActiveIndex((prev) => Math.min(prev, questions.length - 2));
    setDraftState("dirty");
  }, [questions.length]);

  const duplicateQuestion = useCallback((idx: number) => {
    const q = { ...questions[idx], id: uid() };
    q.answers = q.answers.map((a) => ({ ...a, id: uid() }));
    setQuestions((prev) => [...prev.slice(0, idx + 1), q, ...prev.slice(idx + 1)]);
    setActiveIndex(idx + 1);
    setDraftState("dirty");
  }, [questions]);

  const reorderQuestions = useCallback((from: number, to: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setActiveIndex(to);
    setDraftState("dirty");
  }, []);

  const handleSourceSelect = useCallback((type: SourceType) => {
    setSourceType(type);
    if (type === "manual") {
      setStep("builder");
    }
    // Other types show their input inline
  }, []);

  const handleAiGenerate = useCallback(async (sourceMode: "topic" | "document") => {
        const topic = aiTopic.trim();
        if (!topic || topic.length < 5) return;

        if (!user) {
          setAiError("Sign in to use AI quiz generation.");
          return;
        }
        setAiLoading(true);
        setAiError("");
        try {

          const sourceText = sourceMode === "topic" && topic.length < 200
            ? `Topic: ${topic}.\n\nGenerate quiz questions about this topic. Include relevant facts, key concepts, and important details that would make good educational quiz questions. The questions should test knowledge about ${topic}.`
            : topic;
          const sourceTitle = sourceMode === "document" ? "Uploaded document" : topic.slice(0, 60);
          const res = await fetch("/api/ai-source-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceText, sourceTitle, questionCount: aiCount, aiOptions, sourceMode }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "AI generation failed");
          const generated = aiDraftToQuestionData(data.draft);
          setQuestions(generated);
          setQuizTitle(data.draft.title || aiTopic.slice(0, 60));
          setActiveIndex(0);
          setStep("builder");
          setDraftState("dirty");
        } catch (err: any) {
          setAiError(err.message || "Something went wrong");
        } finally {
          setAiLoading(false);
        }
      }, [aiTopic, aiCount, aiOptions, user]);

  const handlePasteImport = useCallback(async () => {
        if (!pasteText.trim()) return;

        if (!user) {
          setAiError("Sign in to use AI quiz generation.");
          return;
        }
        setAiError("");
    
        // Try regex parsing first (structured format)
        const parsed = parseImportedQuestions(pasteText);
    if (parsed.questions && parsed.questions.length > 0) {
      const generated = parsed.questions.map((q: any) => legacyToQuestionData(q));
      setQuestions(generated);
      setActiveIndex(0);
      setStep("builder");
      setDraftState("dirty");
      return;
    }

    // Fallback: treat as source text for AI generation
    if (pasteText.trim().length < 200) {
      setAiError("Paste more text — at least a paragraph for AI to work with.");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-source-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: pasteText,
          sourceTitle: "Pasted content",
          questionCount: aiCount,
          aiOptions,
          sourceMode: "paste",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI generation failed");
      const generated = aiDraftToQuestionData(data.draft);
      setQuestions(generated);
      setQuizTitle(data.draft.title || "Quiz from pasted text");
      setActiveIndex(0);
      setStep("builder");
      setDraftState("dirty");
    } catch (err: any) {
      setAiError(err.message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [pasteText, aiCount, aiOptions, user]);

  const handleUrlFetch = useCallback(async () => {
    if (!aiUrl.trim()) return;

    if (!user) {
      setAiError("Sign in to use AI quiz generation.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: aiUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "URL fetch failed");
      const text = data.text || data.content || "";
      const minChars = aiCount * 150;
      if (text.length < 100) throw new Error("Not enough content found on that page. Try a different URL or paste the content directly.");
      if (text.length < minChars) throw new Error(`This page doesn't have enough readable text for ${aiCount} questions. Try a longer article, or paste the content directly.`);
      // Now generate from that text
      const aiRes = await fetch("/api/ai-source-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text, sourceTitle: aiUrl, questionCount: aiCount, aiOptions, sourceMode: "url" }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || "AI generation failed");
      const generated = aiDraftToQuestionData(aiData.draft);
      setQuestions(generated);
      setQuizTitle(aiData.draft.title || aiUrl.slice(0, 60));
      setActiveIndex(0);
      setStep("builder");
      setDraftState("dirty");
    } catch (err: any) {
      setAiError(err.message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [aiUrl, aiCount, aiOptions, user]);

  const handleEnrich = useCallback(async () => {
    const questionsToEnrich = questions.filter((q) => q.text.trim()).map((q) => ({
      text: q.text,
      answers: q.answers.map((a) => ({ text: a.text, is_correct: a.isCorrect })),
    }));
    if (questionsToEnrich.length === 0) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/ai-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsToEnrich }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrichment failed");
      const enrichments = data.enrichments as Array<{ explanation: string; difficulty: string; confidence: string }>;
      setQuestions((prev) =>
        prev.map((q, i) => {
          const enrichment = enrichments[i];
          if (!enrichment) return q;
          // Map difficulty to time/points if not already set by user
          const difficultyHints: Record<string, { timeLimit: number; points: number }> = {
            easy: { timeLimit: 30, points: 500 },
            medium: { timeLimit: 20, points: 1000 },
            hard: { timeLimit: 10, points: 2000 },
          };
          const hint = difficultyHints[enrichment.difficulty] || difficultyHints.medium;
          return {
            ...q,
            explanation: enrichment.explanation || q.explanation,
            // Only update time/points if they're still at defaults
            timeLimit: q.timeLimit === 20 ? hint.timeLimit : q.timeLimit,
            points: q.points === 1000 ? hint.points : q.points,
          };
        })
      );
      setDraftState("dirty");
    } catch (err: any) {
      setAiError(err.message || "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }, [questions]);

  const draftValue = {
    title: quizTitle, category: quizCategory, emoji: quizEmoji, isPublic, sourceType,
    editingQuizId, questions,
  };
  const draftFingerprint = buildDraftFingerprint({
    ...draftValue,
  });
  const persistDraftValue = useCallback(async (value: typeof draftValue) => {
    if (!user) throw new Error("Sign in to save this draft.");
    try {
      const saved = await saveQuizDraftV2WithConflictRecovery({
        client: supabase as unknown as DraftClient,
        draftId: remoteDraftIdRef.current,
        expectedRevision: remoteRevisionRef.current,
        value,
      });
      remoteDraftIdRef.current = saved.draftId;
      remoteRevisionRef.current = saved.revision;
      setRemoteDraftId(saved.draftId);
      setRemoteRevision(saved.revision);
      sessionStorage.removeItem(CREATE_DRAFT_KEY);
      lastSavedFingerprint.current = buildDraftFingerprint(value);
    } catch (error) {
      if (error instanceof DraftRevisionConflictError) {
        setLoadError("This draft changed in another tab. Reload the page before continuing so newer work is not overwritten.");
      }
      throw error;
    }
  }, [user]);
  const draftAutosave = useSerializedAutosave({
    value: draftValue,
    revisionKey: draftFingerprint,
    enabled: Boolean(user && draftState === "dirty"),
    debounceMs: 2500,
    save: persistDraftValue,
  });
  const previousDraftAutosaveStatus = useRef(draftAutosave.status);
  useEffect(() => {
    if (draftAutosave.status === "saving") setDraftState("saving");
    if (draftAutosave.status === "error") setDraftState("error");
    if (draftAutosave.status === "saved" && previousDraftAutosaveStatus.current !== "saved") {
      setDraftState("saved");
      if (remoteDraftIdRef.current && draftParam !== remoteDraftIdRef.current) {
        router.replace(`/create?draft=${encodeURIComponent(remoteDraftIdRef.current)}`);
      }
    }
    previousDraftAutosaveStatus.current = draftAutosave.status;
  }, [draftAutosave.status, draftParam, router]);

  const saveDraftToSupabase = useCallback(async (_mode: "auto" | "manual") => {
    if (!user) return;
    setDraftState("dirty");
    try {
      await draftAutosave.flush();
    } catch {
      setDraftState("error");
    }
  }, [user, draftAutosave]);
  // ── Keyboard shortcuts (#2) ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+S / Cmd+S → save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveDraftToSupabase("manual");
        return;
      }
      // Ctrl+Enter → add question
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        addQuestion();
        return;
      }
      // Ctrl+Z → undo (simple: do nothing for now, prevents browser undo)
      // Don't interfere with normal text editing
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveDraftToSupabase, addQuestion]);

  const [showConfetti, setShowConfetti] = useState(false);

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    if (!user) {
      // Save state and prompt sign-in
      try {
        sessionStorage.setItem("qw_pending_publish", JSON.stringify({
          quizTitle, quizCategory, quizEmoji, isPublic, questions, editingQuizId,
        }));
      } catch {}
      setShowLoginPrompt(true);
      return;
    }
    setDraftState("saving");
    try {
      const payload = {
        p_title: quizTitle,
        p_category: quizCategory,
        p_emoji: quizEmoji,
        p_color: "",
        p_is_public: isPublic,
        p_questions: questionsToPublishPayload(questions),
      };

      let result;
      if (editingQuizId) {
        result = await supabase.rpc("republish_quiz", { p_quiz_id: editingQuizId, ...payload });
      } else {
        result = await supabase.rpc("publish_quiz", payload);
      }

      if (result.error) throw result.error;

      const published = normalizePublishResult(result.data, editingQuizId);
      if (remoteDraftId && user) {
        const { error: linkError } = await supabase
          .from("quiz_drafts")
          .update({ quiz_id: published.quizId, updated_at: new Date().toISOString() })
          .eq("id", remoteDraftId)
          .eq("owner_id", user.id);
        if (linkError) console.error("Published quiz, but could not link its draft:", linkError);
      }

      // Confetti! (#14)
      sessionStorage.removeItem(CREATE_DRAFT_KEY);
      setShowConfetti(true);
      const dashboardParams = new URLSearchParams();
      dashboardParams.set(published.lifecycle, published.quizId);
      if (published.versionNumber !== null) dashboardParams.set("version", String(published.versionNumber));
      setTimeout(() => {
        router.push(studyPurpose ? `/study/${published.quizId}` : `/dashboard?${dashboardParams.toString()}`);
      }, 1500);
    } catch (err) {
      console.error("Publish error:", err);
      setDraftState("error");
    }
  }, [user, canPublish, quizTitle, quizCategory, quizEmoji, isPublic, questions, editingQuizId, remoteDraftId, router, studyPurpose]);

  if (showLoginPrompt) {
    return (
      <PublishLoginPrompt
        onSignIn={() => {
          const intent = getQuizLifecycleIntent(searchParams);
          sessionStorage.setItem("qw_post_login_redirect", getLifecycleHref(intent));
          router.push("/login");
        }}
        onKeepEditing={() => setShowLoginPrompt(false)}
      />
    );
  }

  if (loadError) {
    return (
      <div className="container" style={{ paddingTop: "3rem" }}>
        <div className="card" role="alert">
          <h2 className="font-display">Could not open this quiz</h2>
          <p className="text-muted">{loadError}</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload draft</button>
            <button className="btn btn-secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "source") {
    return (
      <div>
        <SourcePicker
          onSelect={handleSourceSelect}
          onTemplateSelect={(topic, options) => {
            setAiTopic(topic);
            setAiOptions(options);
            setSourceType("ai-topic");
          }}
        />
        <CreateSourceModals
          sourceType={sourceType}
          aiTopic={aiTopic}
          aiUrl={aiUrl}
          pasteText={pasteText}
          aiCount={aiCount}
          aiOptions={aiOptions}
          aiLoading={aiLoading}
          aiError={aiError}
          onClose={() => setSourceType("manual")}
          onAiTopicChange={setAiTopic}
          onAiUrlChange={setAiUrl}
          onPasteTextChange={setPasteText}
          onAiCountChange={setAiCount}
          onAiOptionsChange={setAiOptions}
          onAiGenerate={(sourceMode) => void handleAiGenerate(sourceMode)}
          onPasteImport={handlePasteImport}
          onUrlFetch={() => void handleUrlFetch()}
        />
      </div>
    );
  }

  return (
    <BuilderWorkspace
      title={quizTitle}
      category={quizCategory}
      emoji={quizEmoji}
      isPublic={isPublic}
      questions={questions}
      activeIndex={activeIndex}
      readyCount={readyCount}
      draftState={draftState}
      canPublish={canPublish}
      showPreview={showPreview}
      showConfetti={showConfetti}
      isEditing={Boolean(editingQuizId)}
      isSignedIn={Boolean(user)}
      onTitleChange={(value) => { setQuizTitle(value); setDraftState("dirty"); }}
      onCategoryChange={(value) => { setQuizCategory(value); setDraftState("dirty"); }}
      onEmojiChange={(value) => { setQuizEmoji(value); setDraftState("dirty"); }}
      onPublicChange={(value) => { setIsPublic(value); setDraftState("dirty"); }}
      onSaveDraft={() => void saveDraftToSupabase("manual")}
      onPreview={() => setShowPreview((value) => !value)}
      onPublish={() => void handlePublish()}
      onBack={() => setStep("source")}
      onSelectQuestion={setActiveIndex}
      onReorderQuestions={reorderQuestions}
      onAddQuestion={addQuestion}
      onAddTrueFalse={addTrueFalse}
      onUpdateQuestion={updateQuestion}
      onDeleteQuestion={deleteQuestion}
      onDuplicateQuestion={duplicateQuestion}
      onEnrich={handleEnrich}
      enriching={enriching}
    />
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-4xl">📝</div>
      </div>
    }>
      <CreatePageContent />
    </Suspense>
  );
}
