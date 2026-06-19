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
  isQuestionComplete,
  legacyToQuestionData,
  makeBlankQuestion,
  makeTrueFalseQuestion,
  questionsToPublishPayload,
} from "@/lib/builder/question-factory";

// ─── Types ──────────────────────────────────────────────────────────────────────

type PageStep = "source" | "builder";
const CREATE_DRAFT_KEY = "qw_create_draft_v9";

// ─── Main page ────────────────────────────────────────────────────────────────

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // ── Core state ──
  const [step, setStep] = useState<PageStep>("source");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [questions, setQuestions] = useState<QuestionData[]>([makeBlankQuestion()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizCategory, setQuizCategory] = useState("General Knowledge");
  const [quizEmoji, setQuizEmoji] = useState("💡");
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // ── Draft state ──
  const [remoteDraftId, setRemoteDraftId] = useState<string | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftSyncState>("idle");
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFingerprint = useRef<string>("");

  // ── AI state ──
  const [aiTopic, setAiTopic] = useState("");
  const [aiUrl, setAiUrl] = useState("");
  const [aiCount, setAiCount] = useState<AIQuestionCount>(10);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [aiOptions, setAiOptions] = useState<AIGenerationOptions>(DEFAULT_AI_OPTIONS);

  // ── Load existing quiz for editing ──
  useEffect(() => {
    const quizParam = searchParams.get("quiz");
    const draftParam = searchParams.get("draft");
    if (!quizParam || draftParam) return;

    let ignore = false;
    async function loadQuiz() {
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .select("*, questions(*, answers(*))")
        .eq("id", quizParam)
        .single();

      if (ignore || error || !quiz) return;

      const sorted = [...(quiz.questions ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      setEditingQuizId(quiz.id);
      setQuizTitle(quiz.title ?? "");
      setQuizCategory(quiz.category ?? "General Knowledge");
      setQuizEmoji(quiz.emoji ?? "💡");
      setIsPublic(quiz.is_public ?? true);
      setStep("builder");
      setQuestions(
        sorted.map((q: any) => ({
          id: q.id || uid(),
          text: q.text ?? "",
          type: q.question_type === "true_false" ? "true_false" : q.question_type === "poll" ? "poll" : "multiple_choice",
          imageUrl: q.image_url ?? "",
          timeLimit: q.time_limit ?? 20,
          points: q.points ?? 1000,
          explanation: q.explanation ?? "",
          answers: [...(q.answers ?? [])]
            .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((a: any) => ({
              id: a.id || uid(),
              text: a.text ?? "",
              imageUrl: a.image_url ?? "",
              isCorrect: a.is_correct ?? false,
            })),
        })) ?? [makeBlankQuestion()]
      );
      setActiveIndex(0);
    }
    loadQuiz();
    return () => { ignore = true; };
  }, [searchParams]);

  // ── Derived ──
  const readyCount = questions.filter(isQuestionComplete).length;
  const canPublish = quizTitle.trim().length > 0 && readyCount > 0;
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // ── Restore saved quiz state after login ──
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

  // ── Question actions ──
  const addQuestion = useCallback(() => {
    const q = makeBlankQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
  }, [questions.length]);

  const addTrueFalse = useCallback(() => {
    const q = makeTrueFalseQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
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
  }, [questions.length]);

  const duplicateQuestion = useCallback((idx: number) => {
    const q = { ...questions[idx], id: uid() };
    q.answers = q.answers.map((a) => ({ ...a, id: uid() }));
    setQuestions((prev) => [...prev.slice(0, idx + 1), q, ...prev.slice(idx + 1)]);
    setActiveIndex(idx + 1);
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

  // ── Source handlers ──
  const handleSourceSelect = useCallback((type: SourceType) => {
    setSourceType(type);
    if (type === "manual") {
      setStep("builder");
    }
    // Other types show their input inline
  }, []);

  const handleAiGenerate = useCallback(async () => {
    const topic = aiTopic.trim();
    if (!topic || topic.length < 5) return;
    setAiLoading(true);
    setAiError("");
    try {
      // Pad short topics to meet the 200-char minimum for source text
      const sourceText = topic.length < 200
        ? `Topic: ${topic}.\n\nGenerate quiz questions about this topic. Include relevant facts, key concepts, and important details that would make good educational quiz questions. The questions should test knowledge about ${topic}.`
        : topic;
      const res = await fetch("/api/ai-source-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, sourceTitle: topic.slice(0, 60), questionCount: aiCount, aiOptions, sourceMode: "topic" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI generation failed");
      const generated = aiDraftToQuestionData(data.draft);
      setQuestions(generated);
      setQuizTitle(data.draft.title || aiTopic.slice(0, 60));
      setActiveIndex(0);
      setStep("builder");
    } catch (err: any) {
      setAiError(err.message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [aiTopic, aiCount, aiOptions]);

  const handlePasteImport = useCallback(async () => {
    if (!pasteText.trim()) return;
    setAiError("");

    // Try regex parsing first (structured format)
    const parsed = parseImportedQuestions(pasteText);
    if (parsed.questions && parsed.questions.length > 0) {
      const generated = parsed.questions.map((q: any) => legacyToQuestionData(q));
      setQuestions(generated);
      setActiveIndex(0);
      setStep("builder");
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
    } catch (err: any) {
      setAiError(err.message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [pasteText, aiCount, aiOptions]);

  const handleUrlFetch = useCallback(async () => {
    if (!aiUrl.trim()) return;
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
    } catch (err: any) {
      setAiError(err.message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [aiUrl, aiCount, aiOptions]);

  // ── AI Enrichment ──
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
    } catch (err: any) {
      setAiError(err.message || "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }, [questions]);

  // ── Draft persistence ──
  const saveDraftToSupabase = useCallback(async (mode: "auto" | "manual") => {
    if (!user) return;
    const fingerprint = JSON.stringify({ title: quizTitle, category: quizCategory, questions: questions.map(q => ({ text: q.text, answers: q.answers.map(a => ({ text: a.text, isCorrect: a.isCorrect })) })) });
    if (fingerprint === lastSavedFingerprint.current) return;

    setDraftState("saving");
    try {
      const draftPayload = {
        title: quizTitle,
        category: quizCategory,
        emoji: quizEmoji,
        color: "",
        is_public: isPublic,
        source_type: sourceType,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      };

      let draftId = remoteDraftId;
      if (draftId) {
        await supabase.from("quiz_drafts").update(draftPayload).eq("id", draftId).eq("owner_id", user.id);
      } else {
        const { data, error } = await supabase.from("quiz_drafts").insert(draftPayload).select("id, updated_at").single();
        if (error) throw error;
        draftId = data.id;
        setRemoteDraftId(draftId);
      }

      // Save questions
      if (draftId) {
        await supabase.from("quiz_draft_questions").delete().eq("draft_id", draftId);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const { data: insertedQ } = await supabase.from("quiz_draft_questions").insert({
            draft_id: draftId, text: q.text, image_url: q.imageUrl || null, time_limit: q.timeLimit, points: q.points, order_index: i, question_type: q.type || "multiple_choice", explanation: q.explanation || null,
          }).select("id").single();
          if (insertedQ) {
            await supabase.from("quiz_draft_answers").insert(
              q.answers.map((a, ai) => ({
                question_id: insertedQ.id, text: a.text, image_url: a.imageUrl || null, is_correct: a.isCorrect, order_index: ai,
              }))
            );
          }
        }
      }

      lastSavedFingerprint.current = fingerprint;
      setDraftState("saved");
    } catch (err) {
      console.error("Draft save error:", err);
      setDraftState("error");
    }
  }, [user, quizTitle, quizCategory, quizEmoji, isPublic, sourceType, questions, remoteDraftId]);

  // Auto-save on changes
  useEffect(() => {
    if (draftState !== "dirty") return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { void saveDraftToSupabase("auto"); }, 2500);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [draftState, saveDraftToSupabase]);

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

  // ── Unsaved changes guard (browser close/refresh) ──
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (draftState === "dirty") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draftState]);

  // ── Confetti state (#14) ──
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
        p_questions: questionsToPublishPayload(questions.filter(isQuestionComplete)),
      };

      let result;
      if (editingQuizId) {
        result = await supabase.rpc("republish_quiz", { p_quiz_id: editingQuizId, ...payload });
      } else {
        result = await supabase.rpc("publish_quiz", payload);
      }

      if (result.error) throw result.error;

      const createdId = result.data;
      if (remoteDraftId && user) {
        await supabase.from("quiz_drafts").update({ quiz_id: createdId, updated_at: new Date().toISOString() }).eq("id", remoteDraftId).eq("owner_id", user.id);
      }

      // Confetti! (#14)
      setShowConfetti(true);
      setTimeout(() => { router.push("/dashboard"); }, 1500);
    } catch (err) {
      console.error("Publish error:", err);
      setDraftState("error");
    }
  }, [user, canPublish, quizTitle, quizCategory, quizEmoji, isPublic, questions, editingQuizId, remoteDraftId, router]);

  // ── Login Prompt Modal ──
  if (showLoginPrompt) {
    return (
      <PublishLoginPrompt
        onSignIn={() => {
          sessionStorage.setItem("qw_post_login_redirect", "/create");
          router.push("/login");
        }}
        onKeepEditing={() => setShowLoginPrompt(false)}
      />
    );
  }

  // Source step
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
          onAiGenerate={() => void handleAiGenerate()}
          onPasteImport={handlePasteImport}
          onUrlFetch={() => void handleUrlFetch()}
        />
      </div>
    );
  }

  // Builder step
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
