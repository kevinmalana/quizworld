"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import {
  uid,
  CATEGORY_COLORS,
  CATEGORY_EMOJIS,
} from "@/lib/store";
import {
  questionsFromDraftRows,
  questionsFromPublishedQuiz,
  questionsFromVersionSnapshot,
  type QuizDraftAnswerRow,
  type QuizDraftQuestionRow,
  type QuizDraftRow,
  type PublishedQuizRow,
  type QuizVersionRow,
} from "@/lib/quiz-drafts";
import {
  extractReadableTextFromHtml,
  parseImportedQuestions,
} from "@/lib/quiz-import";
import {
  aiDraftToQuestions,
  type AIQuizDraft,
} from "@/lib/quiz-ai";
import { SourcePicker, type SourceType } from "@/components/builder/SourcePicker";
import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { QuestionSidebar } from "@/components/builder/QuestionSidebar";
import { QuestionCard, type QuestionData, type QuestionType } from "@/components/builder/QuestionCard";
import type { AnswerData } from "@/components/builder/AnswerEditor";

// ─── Types ──────────────────────────────────────────────────────────────────────

type PageStep = "source" | "builder";
type DraftSyncState = "idle" | "dirty" | "saving" | "saved" | "error";
type AIQuestionCount = 3 | 5 | 8 | 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlankQuestion(): QuestionData {
  return {
    id: uid(),
    text: "",
    type: "multiple_choice",
    timeLimit: 20,
    points: 1000,
    answers: [
      { id: uid(), text: "", isCorrect: true },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
      { id: uid(), text: "", isCorrect: false },
    ],
  };
}

function makeTrueFalse(): QuestionData {
  return {
    id: uid(),
    text: "",
    type: "true_false",
    timeLimit: 10,
    points: 500,
    answers: [
      { id: uid(), text: "True", isCorrect: true },
      { id: uid(), text: "False", isCorrect: false },
    ],
  };
}

function isQuestionComplete(q: QuestionData): boolean {
  if (!q.text.trim()) return false;
  if (q.answers.some((a) => !a.text.trim())) return false;
  if (q.type !== "poll" && q.answers.filter((a) => a.isCorrect).length !== 1) return false;
  return true;
}

function questionsToPublishPayload(questions: QuestionData[]) {
  return questions.map((q) => ({
    text: q.text,
    time_limit: q.timeLimit,
    points: q.points,
    answers: q.answers.map((a) => ({ text: a.text, is_correct: a.isCorrect })),
  }));
}

// Convert legacy Question type to QuestionData
function legacyToQuestionData(q: any): QuestionData {
  return {
    id: q.id || uid(),
    text: q.text || "",
    type: "multiple_choice",
    timeLimit: q.timeLimit || q.time_limit || 20,
    points: q.points || 1000,
    answers: (q.answers || []).map((a: any) => ({
      id: a.id || uid(),
      text: a.text || "",
      isCorrect: a.isCorrect ?? a.is_correct ?? false,
    })),
  };
}

// Convert AI draft to QuestionData[]
function aiDraftToQuestionData(draft: AIQuizDraft): QuestionData[] {
  return draft.questions.map((q) => ({
    id: uid(),
    text: q.text,
    type: "multiple_choice" as QuestionType,
    timeLimit: q.time_limit,
    points: q.points,
    answers: q.answers.map((a) => ({
      id: uid(),
      text: a.text,
      isCorrect: a.is_correct,
    })),
  }));
}

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
  const [quizCategory, setQuizCategory] = useState("Trivia");
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
  const [aiCount, setAiCount] = useState<AIQuestionCount>(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [pasteText, setPasteText] = useState("");

  // ── Derived ──
  const activeQuestion = questions[activeIndex] || null;
  const readyCount = questions.filter(isQuestionComplete).length;
  const canPublish = Boolean(quizTitle.trim()) && readyCount > 0 && Boolean(user);

  // ── Question actions ──
  const addQuestion = useCallback(() => {
    const q = makeBlankQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
  }, [questions.length]);

  const addTrueFalse = useCallback(() => {
    const q = makeTrueFalse();
    setQuestions((prev) => [...prev, q]);
    setActiveIndex(questions.length);
  }, [questions.length]);

  const updateQuestion = useCallback((idx: number, q: QuestionData) => {
    setQuestions((prev) => prev.map((p, i) => (i === idx ? q : p)));
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
        body: JSON.stringify({ sourceText, sourceTitle: topic.slice(0, 60), questionCount: aiCount }),
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
  }, [aiTopic, aiCount]);

  const handlePasteImport = useCallback(() => {
    if (!pasteText.trim()) return;
    const parsed = parseImportedQuestions(pasteText);
    if (!parsed.questions || parsed.questions.length === 0) {
      setAiError(parsed.error || "Could not parse any questions. Try the format: Question? * Correct - Wrong");
      return;
    }
    const generated = parsed.questions.map((q: any) => legacyToQuestionData(q));
    setQuestions(generated);
    setActiveIndex(0);
    setStep("builder");
  }, [pasteText]);

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
      if (text.length < 100) throw new Error("Not enough content found on that page");
      // Now generate from that text
      const aiRes = await fetch("/api/ai-source-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: text, sourceTitle: aiUrl, questionCount: aiCount }),
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
  }, [aiUrl, aiCount]);

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
            draft_id: draftId, text: q.text, time_limit: q.timeLimit, points: q.points, order_index: i,
          }).select("id").single();
          if (insertedQ) {
            await supabase.from("quiz_draft_answers").insert(
              q.answers.map((a, ai) => ({
                question_id: insertedQ.id, text: a.text, is_correct: a.isCorrect, order_index: ai,
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

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!user || !canPublish) return;
    setDraftState("saving");
    try {
      const payload = {
        p_title: quizTitle,
        p_category: quizCategory,
        p_emoji: quizEmoji,
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

      router.push("/dashboard");
    } catch (err) {
      console.error("Publish error:", err);
      setDraftState("error");
    }
  }, [user, canPublish, quizTitle, quizCategory, quizEmoji, isPublic, questions, editingQuizId, remoteDraftId, router]);

  // ── Render ──

  // Source step
  if (step === "source") {
    return (
      <div>
        <SourcePicker onSelect={handleSourceSelect} />

        {/* Inline source inputs */}
        {sourceType === "ai-topic" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-lg mx-4 rounded-3xl p-6 space-y-4" style={{ background: "#1e1e2e", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-white">💡 AI Topic Generator</h2>
                <button onClick={() => setSourceType("manual")} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}>✕</button>
              </div>
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Describe your topic in detail… e.g. 'The solar system and its planets, including dwarf planets and major moons'"
                rows={4}
                className="w-full rounded-2xl p-4 text-sm font-medium text-white outline-none resize-none"
                style={{ border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[rgba(255,255,255,0.4)]">Questions:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold"
                      style={{ background: aiCount === n ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.06)", color: aiCount === n ? "#fff" : "rgba(255,255,255,0.5)", border: aiCount === n ? "none" : "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || aiTopic.trim().length < 5}
                  className="btn btn-primary btn-sm"
                >
                  {aiLoading ? "Generating…" : "Generate ✨"}
                </button>
              </div>
            </div>
          </div>
        )}

        {sourceType === "paste" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-lg mx-4 rounded-3xl p-6 space-y-4" style={{ background: "#1e1e2e", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-white">📋 Paste Questions</h2>
                <button onClick={() => setSourceType("manual")} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}>✕</button>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Question 1: What is the capital of France?\n* Paris\n- London\n- Berlin\n- Rome\n\nQuestion 2: Which planet is closest to the Sun?\nA. Mercury\nB. Venus\nC. Earth\nD. Mars\nAnswer: A"}
                rows={10}
                className="w-full rounded-2xl p-4 text-sm font-mono text-white outline-none resize-none"
                style={{ border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div className="flex justify-end">
                <button onClick={handlePasteImport} className="btn btn-primary btn-sm">Import →</button>
              </div>
            </div>
          </div>
        )}

        {sourceType === "ai-url" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-lg mx-4 rounded-3xl p-6 space-y-4" style={{ background: "#1e1e2e", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-white">🔗 AI from URL</h2>
                <button onClick={() => setSourceType("manual")} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}>✕</button>
              </div>
              <input
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/..."
                className="w-full rounded-2xl p-4 text-sm font-medium text-white outline-none"
                style={{ border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[rgba(255,255,255,0.4)]">Questions:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold"
                      style={{ background: aiCount === n ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.06)", color: aiCount === n ? "#fff" : "rgba(255,255,255,0.5)", border: aiCount === n ? "none" : "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button onClick={handleUrlFetch} disabled={aiLoading || !aiUrl.trim()} className="btn btn-primary btn-sm">
                  {aiLoading ? "Fetching…" : "Fetch & Generate ✨"}
                </button>
              </div>
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
            </div>
          </div>
        )}

        {sourceType === "ai-document" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-lg mx-4 rounded-3xl p-6 space-y-4" style={{ background: "#1e1e2e", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-white">📄 AI from Document</h2>
                <button onClick={() => setSourceType("manual")} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)" }}>✕</button>
              </div>
              <p className="text-sm text-[rgba(255,255,255,0.4)]">Paste your document text below and AI will generate quiz questions from it.</p>
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Paste document content here…"
                rows={10}
                className="w-full rounded-2xl p-4 text-sm font-medium text-white outline-none resize-none"
                style={{ border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[rgba(255,255,255,0.4)]">Questions:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold"
                      style={{ background: aiCount === n ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.06)", color: aiCount === n ? "#fff" : "rgba(255,255,255,0.5)", border: aiCount === n ? "none" : "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button onClick={handleAiGenerate} disabled={aiLoading || aiTopic.trim().length < 20} className="btn btn-primary btn-sm">
                  {aiLoading ? "Generating…" : "Generate ✨"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Builder step
  return (
    <div className="builder-dark flex flex-col">
      {/* Toolbar */}
      <BuilderToolbar
        title={quizTitle}
        category={quizCategory}
        emoji={quizEmoji}
        isPublic={isPublic}
        questionCount={questions.length}
        readyCount={readyCount}
        draftState={draftState}
        canPublish={canPublish}
        onTitleChange={setQuizTitle}
        onCategoryChange={setQuizCategory}
        onEmojiChange={setQuizEmoji}
        onPublicChange={setIsPublic}
        onSaveDraft={() => void saveDraftToSupabase("manual")}
        onPreview={() => setShowPreview(!showPreview)}
        onPublish={handlePublish}
        onBack={() => setStep("source")}
        isEditing={Boolean(editingQuizId)}
      />

      {/* Main content: sidebar + editor */}
      <div className="flex-1 flex">
        {/* Left sidebar */}
        <div
          className="flex-shrink-0 border-r hidden md:flex flex-col"
          style={{ width: 260, borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <QuestionSidebar
            questions={questions}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onReorder={reorderQuestions}
            onAdd={addQuestion}
          />
        </div>
        {/* Mobile sidebar toggle */}
        <div className="md:hidden fixed bottom-4 left-4 z-40">
          <button
            onClick={addQuestion}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{ background: "var(--accent)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-y-auto">
          {showPreview ? (
            /* Preview mode */
            <div className="max-w-2xl mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl text-white">Preview</h2>
                <button onClick={() => setShowPreview(false)} className="btn btn-secondary btn-sm">Back to Editor</button>
              </div>
              {questions.filter(isQuestionComplete).map((q, idx) => (
                <div key={q.id} className="mb-6 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="font-display font-bold text-lg text-white mb-4">{idx + 1}. {q.text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.answers.map((a, ai) => (
                      <div
                        key={a.id}
                        className="rounded-xl p-3 text-sm font-semibold"
                        style={{
                          background: a.isCorrect ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                          border: a.isCorrect ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                          color: a.isCorrect ? "#10b981" : "rgba(255,255,255,0.7)",
                        }}
                      >
                        {["A", "B", "C", "D", "E", "F"][ai]}. {a.text} {a.isCorrect ? "✓" : ""}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="mt-3 text-sm text-[rgba(255,255,255,0.4)] italic">💡 {q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          ) : activeQuestion ? (
            /* Question editor */
            <div className="max-w-3xl mx-auto p-6">
              <QuestionCard
                question={activeQuestion}
                index={activeIndex}
                total={questions.length}
                onChange={(q) => updateQuestion(activeIndex, q)}
                onDelete={() => deleteQuestion(activeIndex)}
                onDuplicate={() => duplicateQuestion(activeIndex)}
              />

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setActiveIndex((i) => Math.max(i - 1, 0))}
                  disabled={activeIndex === 0}
                  className="btn btn-secondary btn-sm disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-[rgba(255,255,255,0.4)]">
                  {activeIndex + 1} / {questions.length}
                </span>
                <button
                  onClick={() => {
                    if (activeIndex < questions.length - 1) {
                      setActiveIndex(activeIndex + 1);
                    } else {
                      addQuestion();
                    }
                  }}
                  className="btn btn-primary btn-sm"
                >
                  {activeIndex < questions.length - 1 ? "Next →" : "+ Add Question"}
                </button>
              </div>

              {/* Quick add buttons */}
              <div className="flex items-center gap-2 mt-4 justify-center">
                <button
                  onClick={addQuestion}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[rgba(255,255,255,0.4)] hover:text-[var(--accent)] transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  + Multiple Choice
                </button>
                <button
                  onClick={addTrueFalse}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[rgba(255,255,255,0.4)] hover:text-[var(--accent)] transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  + True/False
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[rgba(255,255,255,0.4)]">Add a question to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
