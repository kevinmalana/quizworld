"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { uid } from "@/lib/store";
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
import { aiDraftToQuestions } from "@/lib/quiz-ai";
import { SourcePicker, type SourceType } from "@/components/builder/SourcePicker";
import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { QuestionSidebar } from "@/components/builder/QuestionSidebar";
import { QuestionCard, type QuestionData } from "@/components/builder/QuestionCard";
import { Confetti } from "@/components/builder/Confetti";
import { LivePreview } from "@/components/builder/LivePreview";
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
type DraftSyncState = "idle" | "dirty" | "saving" | "saved" | "error";
type AIQuestionCount = 3 | 5 | 8 | 10;

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
  const [aiCount, setAiCount] = useState<AIQuestionCount>(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [pasteText, setPasteText] = useState("");

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
      setQuizCategory(quiz.category ?? "Trivia");
      setQuizEmoji(quiz.emoji ?? "💡");
      setIsPublic(quiz.is_public ?? true);
      setStep("builder");
      setQuestions(
        sorted.map((q: any) => ({
          id: q.id || uid(),
          text: q.text ?? "",
          type: q.question_type === "true_false" ? "true_false" : "multiple_choice",
          imageUrl: q.image_url ?? "",
          timeLimit: q.time_limit ?? 20,
          points: q.points ?? 1000,
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
  const activeQuestion = questions[activeIndex] || null;
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
            draft_id: draftId, text: q.text, image_url: q.imageUrl || null, time_limit: q.timeLimit, points: q.points, order_index: i,
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
  }, [user, canPublish, quizTitle, quizCategory, quizEmoji, isPublic, questions, editingQuizId, remoteDraftId, router, step]);

  // ── Login Prompt Modal ──
  if (showLoginPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="card" style={{ padding: "2.5rem", maxWidth: 420, margin: "0 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Sign in to publish
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
            Your quiz is saved and will be waiting for you after sign in.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => {
                sessionStorage.setItem("qw_post_login_redirect", "/create");
                router.push("/login");
              }}
              className="btn btn-primary"
            >
              Sign In / Sign Up
            </button>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="btn btn-secondary"
            >
              Keep Editing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Source step
  if (step === "source") {
    return (
      <div>
        <SourcePicker onSelect={handleSourceSelect} />

        {/* Inline source inputs */}
        {sourceType === "ai-topic" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
            <div className="card-elevated" style={{ width: "100%", maxWidth: "32rem", margin: "0 1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-[var(--ink)]">💡 AI Topic Generator</h2>
                <button onClick={() => setSourceType("manual")} style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", cursor: "pointer", border: "none", background: "transparent", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>✕</button>
              </div>
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Describe your topic… e.g. 'The solar system and its planets'"
                rows={2}
                style={{ border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0.75rem", borderRadius: "var(--radius-xl)", fontSize: "0.875rem", fontWeight: 500, width: "100%", outline: "none", resize: "none", fontFamily: "inherit" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>Q:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="btn btn-compact"
                      style={{ background: aiCount === n ? "var(--accent)" : "var(--surface)", color: aiCount === n ? "#fff" : "var(--ink)", border: aiCount === n ? "1px solid var(--accent)" : "1px solid var(--line)", padding: "0.375rem 0.625rem", fontSize: "0.8125rem" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || aiTopic.trim().length < 5}
                  className="btn btn-primary btn-compact"
                  style={{ flexShrink: 0 }}
                >
                  {aiLoading ? "Generating…" : "Generate ✨"}
                </button>
              </div>
            </div>
          </div>
        )}

        {sourceType === "paste" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
            <div className="card-elevated" style={{ width: "100%", maxWidth: "32rem", margin: "0 1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-[var(--ink)]">📋 Paste Questions</h2>
                <button onClick={() => setSourceType("manual")} style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", cursor: "pointer", border: "none", background: "transparent", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>✕</button>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Question 1: What is the capital of France?\n* Paris\n- London\n- Berlin\n- Rome"}
                rows={6}
                style={{ border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0.75rem", borderRadius: "var(--radius-xl)", fontSize: "0.8125rem", fontWeight: 500, fontFamily: "monospace", width: "100%", outline: "none", resize: "none" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div className="flex justify-end">
                <button onClick={handlePasteImport} className="btn btn-primary btn-compact">Import →</button>
              </div>
            </div>
          </div>
        )}

        {sourceType === "ai-url" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
            <div className="card-elevated" style={{ width: "100%", maxWidth: "32rem", margin: "0 1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-[var(--ink)]">🔗 AI from URL</h2>
                <button onClick={() => setSourceType("manual")} style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", cursor: "pointer", border: "none", background: "transparent", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>✕</button>
              </div>
              <input
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/..."
                style={{ border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0.75rem", borderRadius: "var(--radius-xl)", fontSize: "0.875rem", fontWeight: 500, width: "100%", outline: "none", fontFamily: "inherit" }}
                autoFocus
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>Q:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="btn btn-compact"
                      style={{ background: aiCount === n ? "var(--accent)" : "var(--surface)", color: aiCount === n ? "#fff" : "var(--ink)", border: aiCount === n ? "1px solid var(--accent)" : "1px solid var(--line)", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button onClick={handleUrlFetch} disabled={aiLoading || !aiUrl.trim()} className="btn btn-primary btn-compact" style={{ flexShrink: 0 }}>
                  {aiLoading ? "Fetching…" : "Fetch & Generate ✨"}
                </button>
              </div>
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
            </div>
          </div>
        )}

        {sourceType === "ai-document" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
            <div className="card-elevated" style={{ width: "100%", maxWidth: "32rem", margin: "0 1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-[var(--ink)]">📄 AI from Document</h2>
                <button onClick={() => setSourceType("manual")} style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", cursor: "pointer", border: "none", background: "transparent", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>✕</button>
              </div>
              <p className="text-sm text-[var(--muted)]">Paste your document text below and AI will generate quiz questions from it.</p>
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Paste document content here…"
                rows={6}
                className="w-full rounded-xl p-3 text-sm font-medium text-[var(--ink)] outline-none resize-none"
                style={{ border: "1.5px solid var(--line)", background: "var(--surface)" }}
                autoFocus
              />
              {aiError && <p className="text-sm font-semibold text-red-500">{aiError}</p>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--muted)", marginRight: "0.25rem" }}>Q:</span>
                  {[3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n as AIQuestionCount)}
                      className="btn btn-compact"
                      style={{ background: aiCount === n ? "var(--accent)" : "var(--surface)", color: aiCount === n ? "#fff" : "var(--ink)", border: aiCount === n ? "1px solid var(--accent)" : "1px solid var(--line)", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button onClick={handleAiGenerate} disabled={aiLoading || aiTopic.trim().length < 20} className="btn btn-primary btn-compact" style={{ flexShrink: 0 }}>
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
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {showConfetti && <Confetti />}
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
        onTitleChange={(v) => { setQuizTitle(v); setDraftState("dirty"); }}
        onCategoryChange={(v) => { setQuizCategory(v); setDraftState("dirty"); }}
        onEmojiChange={(v) => { setQuizEmoji(v); setDraftState("dirty"); }}
        onPublicChange={(v) => { setIsPublic(v); setDraftState("dirty"); }}
        onSaveDraft={() => void saveDraftToSupabase("manual")}
        onPreview={() => setShowPreview(!showPreview)}
        onPublish={handlePublish}
        onBack={() => setStep("source")}
        isEditing={Boolean(editingQuizId)}
        isSignedIn={Boolean(user)}
      />

      {/* Main content: sidebar + editor */}
      <div className="flex-1 flex">
        {/* Left sidebar — hidden on mobile, visible on desktop */}
        <div
          className="card sidebar-desktop"
          style={{ width: 260, flexShrink: 0, borderRadius: 0, borderRight: "1px solid var(--line)", borderLeft: "none", borderTop: "none", borderBottom: "none", flexDirection: "column" }}
        >
          <QuestionSidebar
            questions={questions}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onReorder={reorderQuestions}
            onAdd={addQuestion}
            onDelete={deleteQuestion}
            onDuplicate={duplicateQuestion}
          />
        </div>
        {/* Mobile sidebar toggle */}
        <div className="md:hidden fixed bottom-4 left-4 z-40">
          <button
            onClick={addQuestion}
            className="btn btn-primary"
            style={{ width: "3rem", height: "3rem", borderRadius: "50%", padding: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "1rem 1.5rem", background: "var(--bg)" }}>
          {/* Live Preview Modal (#3) */}
          {showPreview && activeQuestion && (
            <LivePreview
              question={activeQuestion}
              index={activeIndex}
              total={questions.length}
              onClose={() => setShowPreview(false)}
            />
          )}
          {activeQuestion ? (
            /* Question editor */
            <div className="max-w-3xl mx-auto" style={{ padding: "0.5rem 0" }}>
              <QuestionCard
                question={activeQuestion}
                index={activeIndex}
                total={questions.length}
                onChange={(q) => updateQuestion(activeIndex, q)}
                onDelete={() => deleteQuestion(activeIndex)}
                onDuplicate={() => duplicateQuestion(activeIndex)}
              />

              {/* Navigation */}
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => setActiveIndex((i) => Math.max(i - 1, 0))}
                  disabled={activeIndex === 0}
                  className="btn btn-secondary btn-sm disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-[var(--muted)]">
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
              <div className="flex items-center gap-2 mt-2 justify-center">
                <button
                  onClick={addQuestion}
                  className="btn btn-sm btn-ghost"
                  style={{ border: "1px solid var(--line)" }}
                >
                  + Multiple Choice
                </button>
                <button
                  onClick={addTrueFalse}
                  className="btn btn-sm btn-ghost"
                  style={{ border: "1px solid var(--line)" }}
                >
                  + True/False
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--muted)]">Add a question to get started</p>
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
