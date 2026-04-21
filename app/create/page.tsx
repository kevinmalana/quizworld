"use client";

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import {
  uid,
  CATEGORY_COLORS,
  CATEGORY_EMOJIS,
  type Question,
  type Answer,
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
import {
  getAdjacentMoveTarget,
  moveItem,
  type MoveDirection,
} from "@/lib/quiz-builder";

// ─── Types ──────────────────────────────────────────────────────────────────────

type Step = "source" | "ai-loading" | "builder" | "publish";
type SourceType = "ai-topic" | "ai-pdf" | "ai-url" | "manual" | "paste-text";
type DraftSyncState = "idle" | "dirty" | "saving" | "saved" | "error";
type AIQuestionCount = 3 | 5 | 8 | 10;
type QuestionIssue = { message: string; severity: "error" | "warning" };

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = Object.keys(CATEGORY_COLORS);
const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];
const ANSWER_COLORS = ["#e11d48", "#2563eb", "#d97706", "#059669"];
const ANSWER_ICONS = ["▲", "◆", "●", "■"];
const CREATE_DRAFT_KEY = "qw_create_draft_v81";
const PLACEHOLDER_SNIPPETS = [
  "fill in the correct answer",
  "wrong option",
  "correct association",
  "wrong field",
  "the correct field",
  "the most accurate statement",
  "inaccurate statement",
  "cannot be determined",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlankQuestion(): Question {
  return {
    id: uid(),
    text: "",
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

function generateAIQuestions(topic: string): Question[] {
  const t = topic.trim();
  return [
    {
      id: uid(), text: `What is a defining characteristic of ${t}?`, timeLimit: 20, points: 1000,
      answers: [
        { id: uid(), text: "Fill in the correct answer", isCorrect: true },
        { id: uid(), text: "Wrong option 1", isCorrect: false },
        { id: uid(), text: "Wrong option 2", isCorrect: false },
        { id: uid(), text: "Wrong option 3", isCorrect: false },
      ],
    },
    {
      id: uid(), text: `Which of these is most closely associated with ${t}?`, timeLimit: 20, points: 1000,
      answers: [
        { id: uid(), text: "Correct association", isCorrect: true },
        { id: uid(), text: "Wrong option 1", isCorrect: false },
        { id: uid(), text: "Wrong option 2", isCorrect: false },
        { id: uid(), text: "Wrong option 3", isCorrect: false },
      ],
    },
    {
      id: uid(), text: `True or False: ${t} is widely studied and documented.`, timeLimit: 10, points: 500,
      answers: [
        { id: uid(), text: "True", isCorrect: true },
        { id: uid(), text: "False", isCorrect: false },
        { id: uid(), text: "Partially true", isCorrect: false },
        { id: uid(), text: "Cannot be determined", isCorrect: false },
      ],
    },
    {
      id: uid(), text: `What field or domain does ${t} primarily belong to?`, timeLimit: 20, points: 1000,
      answers: [
        { id: uid(), text: "The correct field", isCorrect: true },
        { id: uid(), text: "Wrong field 1", isCorrect: false },
        { id: uid(), text: "Wrong field 2", isCorrect: false },
        { id: uid(), text: "Wrong field 3", isCorrect: false },
      ],
    },
    {
      id: uid(), text: `Which statement about ${t} is most accurate?`, timeLimit: 30, points: 2000,
      answers: [
        { id: uid(), text: "The most accurate statement", isCorrect: true },
        { id: uid(), text: "Inaccurate statement 1", isCorrect: false },
        { id: uid(), text: "Inaccurate statement 2", isCorrect: false },
        { id: uid(), text: "Inaccurate statement 3", isCorrect: false },
      ],
    },
  ];
}

function normalizeQuestions(questions: Question[]) {
  return questions.map((q) => ({
    ...q,
    text: q.text.trim(),
    answers: q.answers.map((a) => ({ ...a, text: a.text.trim() })),
  }));
}

function toPublishPayload(questions: Question[]) {
  return questions.map((q) => ({
    text: q.text,
    time_limit: q.timeLimit,
    points: q.points,
    answers: q.answers.map((a) => ({ text: a.text, is_correct: a.isCorrect })),
  }));
}

function isQuestionComplete(q: Question) {
  return (
    Boolean(q.text) &&
    q.answers.every((a) => Boolean(a.text)) &&
    q.answers.filter((a) => a.isCorrect).length === 1
  );
}

function hasDraftContent(draft: { quizTitle: string; questions: Question[] }) {
  return (
    Boolean(draft.quizTitle.trim()) ||
    draft.questions.length > 1 ||
    draft.questions.some((q) => Boolean(q.text.trim()) || q.answers.some((a) => Boolean(a.text.trim())))
  );
}

function isPlaceholderCopy(value: string) {
  const n = value.trim().toLowerCase();
  return PLACEHOLDER_SNIPPETS.some((s) => n.includes(s));
}

function getRecommendedTimeLimit(text: string) {
  const len = text.trim().length;
  if (len === 0) return 20;
  if (len <= 45) return 10;
  if (len <= 95) return 20;
  if (len <= 160) return 30;
  return 60;
}

function buildDraftFingerprint(opts: {
  quizTitle: string; quizCategory: string; isPublic: boolean;
  sourceType: SourceType; editingQuizId: string | null; questions: Question[];
}) {
  return JSON.stringify({
    title: opts.quizTitle.trim(), category: opts.quizCategory,
    isPublic: opts.isPublic, sourceType: opts.sourceType,
    editingQuizId: opts.editingQuizId,
    questions: opts.questions.map((q) => ({
      text: q.text.trim(), timeLimit: q.timeLimit, points: q.points,
      answers: q.answers.map((a) => ({ text: a.text.trim(), isCorrect: a.isCorrect })),
    })),
  });
}

function getQuestionIssues(q: Question, opts: { duplicateQuestionText: boolean }): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const text = q.text.trim();
  const filled = q.answers.map((a) => a.text.trim()).filter(Boolean);
  const correctCount = q.answers.filter((a) => a.isCorrect).length;
  const unique = new Set(filled.map((a) => a.toLowerCase()));
  if (!text) issues.push({ message: "Question text is missing.", severity: "error" });
  if (filled.length !== q.answers.length) issues.push({ message: "One or more answers are blank.", severity: "error" });
  if (correctCount !== 1) issues.push({ message: "Exactly one correct answer required.", severity: "error" });
  if (filled.length > unique.size) issues.push({ message: "Two answers have the same text.", severity: "warning" });
  if (opts.duplicateQuestionText && text) issues.push({ message: "Duplicate question text detected.", severity: "warning" });
  if (text.length > 140) issues.push({ message: "May be too long for live play on mobile.", severity: "warning" });
  if (q.timeLimit <= 10 && text.length > 90) issues.push({ message: "Timer is aggressive for this reading length.", severity: "warning" });
  if (isPlaceholderCopy(text) || q.answers.some((a) => isPlaceholderCopy(a.text)))
    issues.push({ message: "Starter copy still present — replace before publishing.", severity: "warning" });
  return issues;
}

// ─── AnswerCell ───────────────────────────────────────────────────────────────

function AnswerCell({
  answer, idx, onChange, onCorrect,
}: {
  answer: Answer; idx: number;
  onChange: (text: string) => void;
  onCorrect: () => void;
}) {
  const color = ANSWER_COLORS[idx];
  const icon = ANSWER_ICONS[idx];
  return (
    <div
      className="relative rounded-2xl p-4 transition-all duration-200 group"
      style={{
        background: answer.isCorrect ? color + "12" : "var(--surface)",
        border: `1.5px solid ${answer.isCorrect ? color : "var(--line)"}`,
        minHeight: 80,
      }}
    >
      {/* Color marker + correct toggle */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <button
          onClick={onCorrect}
          title="Mark as correct"
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all duration-150"
          style={{
            background: answer.isCorrect ? color : color + "20",
            color: answer.isCorrect ? "#fff" : color,
          }}
        >
          {answer.isCorrect ? "✓" : icon}
        </button>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: answer.isCorrect ? color : "var(--muted)" }}>
          {["A", "B", "C", "D"][idx]}
        </span>
      </div>
      <input
        type="text"
        value={answer.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Answer ${["A", "B", "C", "D"][idx]}${answer.isCorrect ? " (correct)" : ""}`}
        className="w-full bg-transparent font-semibold text-[var(--ink)] outline-none text-sm"
        style={{ minWidth: 0 }}
      />
    </div>
  );
}

// ─── QuestionEditor (focused single-card view) ───────────────────────────────

function QuestionEditor({
  question, index, total, issues, onChange, onDelete, onDuplicate, onMove,
}: {
  question: Question; index: number; total: number; issues: QuestionIssue[];
  onChange: (q: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: MoveDirection) => void;
}) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.length - errorCount;

  const setAnswerText = (i: number, text: string) =>
    onChange({ ...question, answers: question.answers.map((a, ai) => (ai === i ? { ...a, text } : a)) });

  const setCorrect = (i: number) =>
    onChange({ ...question, answers: question.answers.map((a, ai) => ({ ...a, isCorrect: ai === i })) });

  return (
    <div className="flex flex-col gap-5">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm text-white"
            style={{ background: "var(--accent)" }}
          >
            {index + 1}
          </div>
          <span className="font-display font-bold text-sm text-[var(--muted)]">
            Question {index + 1} of {total}
          </span>
          {errorCount > 0 && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}
            >
              {errorCount} fix{errorCount === 1 ? "" : "es"}
            </span>
          )}
          {errorCount === 0 && warnCount > 0 && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "#fff7ed", color: "#c2410c" }}
            >
              {warnCount} flag{warnCount === 1 ? "" : "s"}
            </span>
          )}
          {errorCount === 0 && warnCount === 0 && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "var(--success-light)", color: "var(--success)" }}
            >
              Ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            title="Move up"
            className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] text-[var(--muted)] text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >↑</button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index >= total - 1}
            title="Move down"
            className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] text-[var(--muted)] text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >↓</button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate"
            className="w-8 h-8 rounded-lg hover:bg-[#f1f5f9] text-[var(--muted)] text-sm transition-colors"
          >⧉</button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-400 text-sm transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Inline issues */}
      {issues.length > 0 && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          {issues.map((issue) => (
            <p key={issue.message} className="text-xs font-semibold"
              style={{ color: issue.severity === "error" ? "var(--primary)" : "#b45309" }}>
              {issue.severity === "error" ? "⚠ Fix:" : "◦ Check:"} {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* Question text */}
      <textarea
        value={question.text}
        onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Type your question here…"
        rows={3}
        className="w-full font-display font-bold text-xl text-[var(--ink)] rounded-xl p-4 outline-none resize-none"
        style={{ border: "1.5px solid var(--line)", lineHeight: 1.5, background: "var(--surface)" }}
      />

      {/* Answer grid — collapses to one column on narrow screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.answers.map((answer, idx) => (
          <AnswerCell
            key={answer.id}
            answer={answer}
            idx={idx}
            onChange={(text) => setAnswerText(idx, text)}
            onCorrect={() => setCorrect(idx)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SidebarItem ─────────────────────────────────────────────────────────────

function SidebarItem({
  question, index, total, isActive, issueCount, isComplete, onClick, onMove,
}: {
  question: Question; index: number; total: number; isActive: boolean;
  issueCount: number; isComplete: boolean; onClick: () => void;
  onMove: (direction: MoveDirection) => void;
}) {
  const dot = isComplete
    ? { bg: "var(--success)", title: "Ready" }
    : issueCount > 0
      ? { bg: "var(--primary)", title: `${issueCount} issue${issueCount === 1 ? "" : "s"}` }
      : { bg: "var(--muted)", title: "Empty" };

  return (
    <div
      className="w-32 lg:w-full rounded-xl transition-all duration-150 flex items-center gap-2 p-1.5 group flex-shrink-0"
      style={{
        background: isActive ? "var(--accent-light)" : "transparent",
        border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left px-1.5 py-1 flex items-center gap-2.5"
      >
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center font-display font-black text-xs transition-colors"
          style={{
            background: isActive ? "var(--accent)" : "var(--bg)",
            color: isActive ? "#fff" : "var(--muted)",
            border: isActive ? "none" : "1px solid var(--line)",
          }}
        >
          {index + 1}
        </div>
        <p className="flex-1 text-xs font-semibold text-[var(--ink)] truncate leading-snug" style={{ maxWidth: 120 }}>
          {question.text || "Empty question"}
        </p>
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dot.bg }}
          title={dot.title}
        />
      </button>
      <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMove("up");
          }}
          title="Move up"
          disabled={index === 0}
          className="w-6 h-6 rounded-md text-[10px] font-bold text-[var(--muted)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMove("down");
          }}
          title="Move down"
          disabled={index === total - 1}
          className="w-6 h-6 rounded-md text-[10px] font-bold text-[var(--muted)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const draftParam = searchParams.get("draft");
  const quizParam = searchParams.get("quiz");
  const versionParam = searchParams.get("version");
  const duplicateParam = searchParams.get("duplicate") === "1";

  // ── Core state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("source");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [aiTopic, setAiTopic] = useState("");
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState("");
  const [questions, setQuestions] = useState<Question[]>([makeBlankQuestion()]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizCategory, setQuizCategory] = useState("Trivia");
  const [isPublic, setIsPublic] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [textImport, setTextImport] = useState("");
  const [textImportError, setTextImportError] = useState("");
  const [textImportNotice, setTextImportNotice] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlImportLoading, setUrlImportLoading] = useState(false);
  const [urlImportError, setUrlImportError] = useState("");
  const [documentImportName, setDocumentImportName] = useState("");
  const [sourceMaterialTitle, setSourceMaterialTitle] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState<AIQuestionCount>(5);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftError, setAiDraftError] = useState("");
  const [aiDraftReview, setAiDraftReview] = useState<AIQuizDraft | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>({});
  const [remoteDraftId, setRemoteDraftId] = useState<string | null>(null);
  const [remoteDraftUpdatedAt, setRemoteDraftUpdatedAt] = useState<string | null>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [loadingRemoteSource, setLoadingRemoteSource] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSyncState, setDraftSyncState] = useState<DraftSyncState>("idle");
  const [draftSyncError, setDraftSyncError] = useState("");
  const [saveDraftError, setSaveDraftError] = useState("");
  const [saveDraftNotice, setSaveDraftNotice] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosaveRef = useRef(true);
  const lastSyncedDraftRef = useRef("");

  // ── Derived values ──────────────────────────────────────────────────────────
  const normalizedQs = normalizeQuestions(questions);
  const questionTextCounts = normalizedQs.reduce((m, q) => {
    const k = q.text.trim().toLowerCase();
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, new Map<string, number>());
  const questionIssues = normalizedQs.map((q) =>
    getQuestionIssues(q, { duplicateQuestionText: (questionTextCounts.get(q.text.trim().toLowerCase()) ?? 0) > 1 })
  );
  const validCount = normalizedQs.filter(isQuestionComplete).length;
  const incompleteCount = normalizedQs.length - validCount;
  const warningCount = questionIssues.flat().filter((i) => i.severity === "warning").length;
  const placeholderCount = questionIssues.filter((iss) =>
    iss.some((i) => i.message === "Starter copy still present — replace before publishing.")
  ).length;
  const timingRiskCount = questionIssues.filter((iss) =>
    iss.some((i) => i.message === "Timer is aggressive for this reading length.")
  ).length;
  const suggestedTimerCount = normalizedQs.filter(
    (q) => Boolean(q.text.trim()) && q.timeLimit !== getRecommendedTimeLimit(q.text)
  ).length;
  const completeQuestions = normalizedQs.filter(isQuestionComplete);
  const previewQuestion = completeQuestions[previewIndex] ?? null;
  const previewAnswer = previewQuestion
    ? previewQuestion.answers.find((a) => a.id === previewSelections[previewQuestion.id]) ?? null
    : null;
  const previewCorrectAnswer = previewQuestion
    ? previewQuestion.answers.find((a) => a.isCorrect) ?? null
    : null;
  const estimatedDurationSeconds = normalizedQs.reduce((t, q) => t + q.timeLimit, 0);
  const draftFingerprint = buildDraftFingerprint({
    quizTitle, quizCategory, isPublic, sourceType, editingQuizId, questions: normalizedQs,
  });
  const hasAnyDraftContent = hasDraftContent({ quizTitle, questions: normalizedQs });
  const activeQuestion = questions[activeQuestionIndex] ?? questions[0];
  const activeIssues = questionIssues[activeQuestionIndex] ?? [];
  const safeActiveIdx = Math.min(activeQuestionIndex, questions.length - 1);

  // ── Draft sync label ────────────────────────────────────────────────────────
  const draftStatusMeta = !user
    ? { label: "Sign in to save", tone: "var(--secondary)", bg: "var(--secondary-light)" }
    : !hasAnyDraftContent
      ? { label: "Add content to save", tone: "var(--muted)", bg: "var(--bg)" }
      : draftSyncState === "saving"
        ? { label: "Saving…", tone: "var(--accent)", bg: "var(--accent-light)" }
        : draftSyncState === "dirty"
          ? { label: remoteDraftId ? "Unsaved changes" : "Ready to save", tone: "#c2410c", bg: "#fff7ed" }
          : draftSyncState === "error"
            ? { label: draftSyncError || "Sync failed", tone: "var(--primary)", bg: "var(--primary-light)" }
            : remoteDraftUpdatedAt
              ? {
                  label: `Saved ${new Date(remoteDraftUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                  tone: "var(--success)", bg: "var(--success-light)",
                }
              : { label: "Ready to save", tone: "var(--success)", bg: "var(--success-light)" };

  // ── Draft persistence ──────────────────────────────────────────────────────
  async function persistDraft(mode: "manual" | "auto") {
    if (authLoading || !user || !hasAnyDraftContent) return;
    const draftTitle = quizTitle.trim() || "Untitled Draft";
    const now = new Date().toISOString();
    if (mode === "manual") { setSavingDraft(true); setSaveDraftError(""); setSaveDraftNotice(""); setPublishError(""); }
    setDraftSyncState("saving"); setDraftSyncError("");
    try {
      let draftId = remoteDraftId;
      if (draftId) {
        const { error } = await supabase.from("quiz_drafts").update({
          quiz_id: editingQuizId, title: draftTitle, category: quizCategory,
          emoji: CATEGORY_EMOJIS[quizCategory] ?? "🧠", color: CATEGORY_COLORS[quizCategory] ?? "#8b5cf6",
          is_public: isPublic, source_type: sourceType, updated_at: now,
        }).eq("id", draftId).eq("owner_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("quiz_drafts").insert({
          owner_id: user.id, quiz_id: editingQuizId, title: draftTitle, category: quizCategory,
          emoji: CATEGORY_EMOJIS[quizCategory] ?? "🧠", color: CATEGORY_COLORS[quizCategory] ?? "#8b5cf6",
          is_public: isPublic, source_type: sourceType, updated_at: now,
        }).select("id, updated_at").single();
        if (error) throw error;
        draftId = data.id;
        setRemoteDraftId(data.id);
        setRemoteDraftUpdatedAt(data.updated_at ?? now);
      }
      if (!draftId) throw new Error("Could not create a draft.");
      const { error: delErr } = await supabase.from("quiz_draft_questions").delete().eq("draft_id", draftId);
      if (delErr) throw delErr;
      for (const [qi, q] of normalizedQs.entries()) {
        const { data: insertedQ, error: qErr } = await supabase.from("quiz_draft_questions").insert({
          draft_id: draftId, text: q.text, time_limit: q.timeLimit, points: q.points, order_index: qi,
        }).select("id").single();
        if (qErr) throw qErr;
        const { error: aErr } = await supabase.from("quiz_draft_answers").insert(
          q.answers.map((a, ai) => ({ question_id: insertedQ.id, text: a.text, is_correct: a.isCorrect, order_index: ai }))
        );
        if (aErr) throw aErr;
      }
      if (autosaveTimeoutRef.current) { clearTimeout(autosaveTimeoutRef.current); autosaveTimeoutRef.current = null; }
      lastSyncedDraftRef.current = draftFingerprint;
      setRemoteDraftId(draftId);
      setRemoteDraftUpdatedAt(now);
      setRestoredDraft(false);
      setDraftSyncState("saved"); setDraftSyncError("");
      if (mode === "manual") setSaveDraftNotice(remoteDraftId ? "Draft saved." : "Draft created and saved.");
      const nextUrl = `/create?draft=${draftId}`;
      if (draftParam !== draftId) router.replace(nextUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not save the draft.";
      setDraftSyncState("error"); setDraftSyncError(msg);
      if (mode === "manual") setSaveDraftError(msg);
    } finally {
      if (mode === "manual") setSavingDraft(false);
    }
  }

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const redirectTarget = draftParam ? `/create?draft=${draftParam}`
      : quizParam ? `/create?quiz=${quizParam}${duplicateParam ? "&duplicate=1" : ""}`
      : versionParam ? `/create?version=${versionParam}` : "/create";
    if ((draftParam || quizParam || versionParam) && !user) {
      sessionStorage.setItem("qw_post_login_redirect", redirectTarget);
      router.push("/login"); return;
    }
    if (!user || (!draftParam && !quizParam && !versionParam)) return;
    let cancelled = false;
    async function loadRemoteSource() {
      setLoadingRemoteSource(true); setPublishError(""); setSaveDraftError("");
      try {
        if (draftParam) {
          const { data: draft, error: draftError } = await supabase
            .from("quiz_drafts").select("id,quiz_id,title,category,emoji,color,is_public,source_type,updated_at")
            .eq("id", draftParam).single();
          if (draftError) throw draftError;
          const { data: draftQs, error: dqErr } = await supabase
            .from("quiz_draft_questions").select("id,draft_id,text,time_limit,points,order_index")
            .eq("draft_id", draftParam).order("order_index", { ascending: true });
          if (dqErr) throw dqErr;
          const qids = ((draftQs as QuizDraftQuestionRow[] | null) ?? []).map((q) => q.id);
          const { data: draftAs, error: daErr } = qids.length > 0
            ? await supabase.from("quiz_draft_answers").select("id,question_id,text,is_correct,order_index")
                .in("question_id", qids).order("order_index", { ascending: true })
            : { data: [], error: null };
          if (daErr) throw daErr;
          if (cancelled) return;
          const d = draft as QuizDraftRow;
          setRemoteDraftId(d.id); setRemoteDraftUpdatedAt(d.updated_at); setEditingQuizId(d.quiz_id);
          setQuizTitle(d.title ?? ""); setQuizCategory(d.category ?? "Trivia");
          setIsPublic(d.is_public ?? true); setSourceType((d.source_type as SourceType) ?? "manual");
          const hq = questionsFromDraftRows((draftQs as QuizDraftQuestionRow[]) ?? [], (draftAs as QuizDraftAnswerRow[]) ?? []);
          lastSyncedDraftRef.current = buildDraftFingerprint({ quizTitle: d.title ?? "", quizCategory: d.category ?? "Trivia", isPublic: d.is_public ?? true, sourceType: (d.source_type as SourceType) ?? "manual", editingQuizId: d.quiz_id, questions: hq });
          skipAutosaveRef.current = true; setDraftSyncState("saved"); setDraftSyncError("");
          setQuestions(hq.length > 0 ? hq : [makeBlankQuestion()]); setActiveQuestionIndex(0);
          setStep("builder"); setRestoredDraft(false); setSaveDraftNotice("Draft loaded."); return;
        }
        if (quizParam) {
          const { data: quiz, error: quizErr } = await supabase.from("quizzes")
            .select("id,title,category,emoji,color,is_public,questions(id,text,time_limit,points,order_index,answers(id,text,is_correct))")
            .eq("id", quizParam).eq("creator_id", user!.id).single();
          if (quizErr) throw quizErr;
          if (cancelled) return;
          const lq = quiz as PublishedQuizRow;
          setRemoteDraftId(null); setRemoteDraftUpdatedAt(null);
          setEditingQuizId(duplicateParam ? null : lq.id);
          setQuizTitle(duplicateParam ? `${lq.title ?? "Untitled Quiz"} Copy` : lq.title ?? "");
          setQuizCategory(lq.category ?? "Trivia"); setIsPublic(lq.is_public ?? true); setSourceType("manual");
          const hq = questionsFromPublishedQuiz(lq);
          lastSyncedDraftRef.current = buildDraftFingerprint({ quizTitle: duplicateParam ? `${lq.title ?? "Untitled Quiz"} Copy` : lq.title ?? "", quizCategory: lq.category ?? "Trivia", isPublic: lq.is_public ?? true, sourceType: "manual", editingQuizId: duplicateParam ? null : lq.id, questions: hq });
          skipAutosaveRef.current = true; setDraftSyncState("idle"); setDraftSyncError("");
          setQuestions(hq.length > 0 ? hq : [makeBlankQuestion()]); setActiveQuestionIndex(0);
          setStep("builder"); setRestoredDraft(false);
          setSaveDraftNotice(duplicateParam ? "Quiz duplicated. Save as draft or publish as new." : "Published quiz loaded. Save as draft before republishing."); return;
        }
        if (versionParam) {
          const { data: version, error: vErr } = await supabase.from("quiz_versions")
            .select("id,quiz_id,creator_id,version_number,title,category,emoji,color,is_public,snapshot,created_at")
            .eq("id", versionParam).single();
          if (vErr) throw vErr;
          if (cancelled) return;
          const lv = version as QuizVersionRow;
          setRemoteDraftId(null); setRemoteDraftUpdatedAt(null); setEditingQuizId(lv.quiz_id);
          setQuizTitle(lv.snapshot.title ?? lv.title ?? ""); setQuizCategory(lv.snapshot.category ?? lv.category ?? "Trivia");
          setIsPublic(lv.snapshot.is_public ?? lv.is_public ?? true); setSourceType("manual");
          const hq = questionsFromVersionSnapshot(lv);
          lastSyncedDraftRef.current = buildDraftFingerprint({ quizTitle: lv.snapshot.title ?? lv.title ?? "", quizCategory: lv.snapshot.category ?? lv.category ?? "Trivia", isPublic: lv.snapshot.is_public ?? lv.is_public ?? true, sourceType: "manual", editingQuizId: lv.quiz_id, questions: hq });
          skipAutosaveRef.current = true; setDraftSyncState("idle"); setDraftSyncError("");
          setQuestions(hq.length > 0 ? hq : [makeBlankQuestion()]); setActiveQuestionIndex(0);
          setStep("builder"); setRestoredDraft(false);
          setSaveDraftNotice(`Loaded version ${lv.version_number} from ${new Date(lv.created_at).toLocaleString()}.`);
        }
      } catch (error) {
        if (!cancelled) setPublishError(error instanceof Error ? error.message : "Could not load this draft.");
      } finally {
        if (!cancelled) setLoadingRemoteSource(false);
      }
    }
    loadRemoteSource();
    return () => { cancelled = true; };
  }, [authLoading, draftParam, duplicateParam, quizParam, router, user, versionParam]);

  useEffect(() => {
    if (!showPreview) return;
    setPreviewIndex((c) => Math.min(c, Math.max(completeQuestions.length - 1, 0)));
  }, [completeQuestions.length, showPreview]);

  useEffect(() => {
    if (draftParam || quizParam || versionParam) return;
    const raw = sessionStorage.getItem(CREATE_DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.questions) || !hasDraftContent({ quizTitle: d.quizTitle ?? "", questions: d.questions })) return;
      setQuizTitle(d.quizTitle ?? ""); setQuizCategory(d.quizCategory ?? "Trivia");
      setIsPublic(d.isPublic ?? true); setQuestions(d.questions); setSourceType(d.sourceType ?? "manual");
      setRestoredDraft(true); lastSyncedDraftRef.current = ""; skipAutosaveRef.current = false;
      setDraftSyncState("dirty"); setDraftSyncError("");
      setStep(d.step === "source" || d.step === "ai-loading" ? "builder" : d.step ?? "builder");
    } catch {}
  }, []);

  useEffect(() => {
    const d = { step: step === "ai-loading" ? "builder" : step, sourceType, quizTitle, quizCategory, isPublic, questions };
    if (hasDraftContent({ quizTitle, questions })) sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(CREATE_DRAFT_KEY);
  }, [isPublic, questions, quizCategory, quizTitle, sourceType, step]);

  useEffect(() => {
    if (authLoading || !user || loadingRemoteSource) return;
    if (step === "source" || step === "ai-loading") return;
    if (!hasAnyDraftContent) { setDraftSyncState("idle"); setDraftSyncError(""); lastSyncedDraftRef.current = ""; return; }
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    if (draftFingerprint === lastSyncedDraftRef.current) return;
    setDraftSyncState("dirty"); setDraftSyncError("");
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => { void persistDraft("auto"); }, 2500);
    return () => { if (autosaveTimeoutRef.current) { clearTimeout(autosaveTimeoutRef.current); autosaveTimeoutRef.current = null; } };
  }, [authLoading, draftFingerprint, hasAnyDraftContent, loadingRemoteSource, step, user]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const resetBuilder = () => {
    sessionStorage.removeItem(CREATE_DRAFT_KEY);
    if (autosaveTimeoutRef.current) { clearTimeout(autosaveTimeoutRef.current); autosaveTimeoutRef.current = null; }
    lastSyncedDraftRef.current = ""; skipAutosaveRef.current = true;
    setRemoteDraftId(null); setRemoteDraftUpdatedAt(null); setEditingQuizId(null);
    setDraftSyncState("idle"); setDraftSyncError(""); setStep("source"); setSourceType("manual");
    setAiTopic(""); setAiProgress(0); setAiStatus(""); setQuizTitle(""); setQuizCategory("Trivia");
    setIsPublic(true); setQuestions([makeBlankQuestion()]); setActiveQuestionIndex(0);
    setPublishError(""); setSaveDraftError(""); setSaveDraftNotice(""); setTextImport("");
    setTextImportError(""); setTextImportNotice(""); setUrlInput(""); setUrlImportError("");
    setDocumentImportName(""); setSourceMaterialTitle(""); setAiDraftError(""); setAiDraftReview(null);
    setShowPreview(false); setPreviewIndex(0); setPreviewSelections({}); setRestoredDraft(false);
    router.replace("/create");
  };

  const startAIGeneration = () => {
    if (!aiTopic.trim()) return;
    setSourceType("ai-topic"); setStep("ai-loading"); setAiProgress(0); setShowPreview(false);
    setSaveDraftError(""); setSaveDraftNotice(""); setTextImportNotice(""); setUrlImportError("");
    setAiDraftError(""); setAiDraftReview(null); setDraftSyncState("dirty"); setDraftSyncError("");
    const steps = ["Analyzing topic…", "Searching knowledge base…", "Generating questions…", "Checking quality…", "Finalising quiz…"];
    let i = 0;
    setAiStatus(steps[0]);
    progressRef.current = setInterval(() => {
      i++;
      setAiProgress(Math.min(100, (i / steps.length) * 100));
      setAiStatus(steps[Math.min(i, steps.length - 1)]);
      if (i >= steps.length) {
        clearInterval(progressRef.current!);
        setQuestions(generateAIQuestions(aiTopic));
        setQuizTitle(aiTopic.charAt(0).toUpperCase() + aiTopic.slice(1) + " Quiz");
        setActiveQuestionIndex(0); setRestoredDraft(false); setPreviewSelections({});
        lastSyncedDraftRef.current = ""; skipAutosaveRef.current = false;
        setRemoteDraftId(null); setRemoteDraftUpdatedAt(null); setEditingQuizId(null);
        router.replace("/create");
        setTimeout(() => setStep("builder"), 500);
      }
    }, 600);
  };

  const loadImportedQuestions = (qs: Question[], nextSourceType: SourceType) => {
    setQuestions(qs); setSourceType(nextSourceType); setStep("builder"); setActiveQuestionIndex(0);
    setShowPreview(false); setPreviewIndex(0); setPreviewSelections({}); setRestoredDraft(false);
    setRemoteDraftId(null); setRemoteDraftUpdatedAt(null); setEditingQuizId(null);
    lastSyncedDraftRef.current = ""; skipAutosaveRef.current = false;
    setDraftSyncState("dirty"); setDraftSyncError(""); setSaveDraftError(""); setSaveDraftNotice("");
    setTextImportNotice(""); setUrlImportError(""); setAiDraftError(""); setAiDraftReview(null);
    router.replace("/create");
  };

  const handleTextImport = (nextSourceType: SourceType = "paste-text") => {
    setTextImportError(""); setTextImportNotice("");
    const parsed = parseImportedQuestions(textImport);
    if (parsed.error) { setTextImportError(parsed.error); return; }
    loadImportedQuestions(parsed.questions, nextSourceType);
    if (!quizTitle.trim()) setQuizTitle(nextSourceType === "ai-url" ? "Imported From URL" : nextSourceType === "ai-pdf" ? "Imported Document Quiz" : "Imported Quiz");
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlImportLoading(true); setUrlImportError(""); setTextImportError(""); setTextImportNotice(""); setAiDraftError(""); setAiDraftReview(null);
    try {
      const res = await fetch("/api/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim() }) });
      const payload = await res.json() as { error?: string; text?: string; title?: string };
      if (!res.ok) throw new Error(payload.error || "Could not import this URL.");
      const imported = payload.text?.trim() ?? "";
      if (!imported) throw new Error("This URL did not produce enough text to import.");
      setSourceType("ai-url"); setTextImport(imported);
      setTextImportNotice("URL content fetched. Review the text, then convert to quiz cards.");
      setSourceMaterialTitle(payload.title?.trim() || urlInput.trim());
      if (!quizTitle.trim() && payload.title) setQuizTitle(payload.title);
    } catch (error) {
      setUrlImportError(error instanceof Error ? error.message : "Could not import this URL.");
    } finally { setUrlImportLoading(false); }
  };

  const handleDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTextImportError(""); setTextImportNotice(""); setDocumentImportName(file.name);
    setSourceType("ai-pdf"); setAiDraftError(""); setAiDraftReview(null);
    setSourceMaterialTitle(file.name.replace(/\.[^.]+$/, ""));
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setTextImportError("Direct PDF parsing not bundled. Paste extracted text below instead.");
      e.target.value = ""; return;
    }
    try {
      const raw = await file.text();
      const norm = file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm")
        ? extractReadableTextFromHtml(raw) : raw.trim();
      if (!norm) throw new Error("This file did not contain readable text.");
      setTextImport(norm);
      setTextImportNotice(`Loaded ${file.name}. Review then convert to quiz cards.`);
    } catch (error) {
      setTextImportError(error instanceof Error ? error.message : "Could not read this file.");
    } finally { e.target.value = ""; }
  };

  const updateSourceText = (value: string) => {
    setTextImport(value);
    if (aiDraftReview) setAiDraftReview(null);
    if (aiDraftError) setAiDraftError("");
  };

  const generateAIDraftFromSource = async () => {
    if (!textImport.trim()) { setAiDraftError("Add source material first."); return; }
    setAiDraftLoading(true); setAiDraftError(""); setAiDraftReview(null);
    try {
      const res = await fetch("/api/ai-source-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: textImport, sourceTitle: sourceMaterialTitle || quizTitle || "Source material", sourceLabel: sourceType === "ai-url" ? "Imported URL" : sourceType === "ai-pdf" ? documentImportName || "Imported document" : "Pasted source material", questionCount: aiQuestionCount }),
      });
      const payload = await res.json() as { error?: string; draft?: AIQuizDraft };
      if (!res.ok || !payload.draft) throw new Error(payload.error || "Could not generate a draft.");
      setAiDraftReview(payload.draft);
      if (!quizTitle.trim() && payload.draft.title) setQuizTitle(payload.draft.title);
    } catch (error) {
      setAiDraftError(error instanceof Error ? error.message : "Could not generate a draft.");
    } finally { setAiDraftLoading(false); }
  };

  const loadAIDraftIntoBuilder = () => {
    if (!aiDraftReview) return;
    if (!quizTitle.trim()) setQuizTitle(aiDraftReview.title);
    const nextSourceType =
      sourceType === "ai-url" || sourceType === "ai-pdf" || sourceType === "paste-text"
        ? sourceType
        : "ai-topic";
    loadImportedQuestions(aiDraftToQuestions(aiDraftReview), nextSourceType);
    setSaveDraftNotice("AI draft loaded. Review wording and distractors before publishing.");
  };

  const addQuestion = () => {
    const next = [...questions, makeBlankQuestion()];
    setQuestions(next);
    setActiveQuestionIndex(next.length - 1);
  };

  const addTrueFalse = () => {
    const next = [...questions, { id: uid(), text: "True or false:", timeLimit: 10, points: 500, answers: [{ id: uid(), text: "True", isCorrect: true }, { id: uid(), text: "False", isCorrect: false }, { id: uid(), text: "", isCorrect: false }, { id: uid(), text: "", isCorrect: false }] }];
    setQuestions(next);
    setActiveQuestionIndex(next.length - 1);
  };

  const updateQuestion = (idx: number, q: Question) =>
    setQuestions((qs) => qs.map((old, i) => (i === idx ? q : old)));

  const moveQuestion = (idx: number, direction: MoveDirection) => {
    const targetIndex = getAdjacentMoveTarget(idx, direction, questions.length);
    if (targetIndex === idx) return;
    setQuestions((qs) => moveItem(qs, idx, targetIndex));
    setActiveQuestionIndex(targetIndex);
    setSaveDraftNotice(`Moved question ${idx + 1} ${direction}.`);
    setSaveDraftError("");
  };

  const deleteQuestion = (idx: number) => {
    if (questions.length === 1) return;
    const next = questions.filter((_, i) => i !== idx);
    setQuestions(next);
    setActiveQuestionIndex(Math.min(idx, next.length - 1));
  };

  const duplicateQuestion = (idx: number) => {
    const next = [
      ...questions.slice(0, idx + 1),
      { ...questions[idx], id: uid(), answers: questions[idx].answers.map((a) => ({ ...a, id: uid() })) },
      ...questions.slice(idx + 1),
    ];
    setQuestions(next);
    setActiveQuestionIndex(idx + 1);
  };

  const handleSaveDraft = async () => {
    if (authLoading) return;
    if (!user) {
      const redirect = remoteDraftId ? `/create?draft=${remoteDraftId}` : editingQuizId ? `/create?quiz=${editingQuizId}` : versionParam ? `/create?version=${versionParam}` : "/create";
      sessionStorage.setItem("qw_post_login_redirect", redirect);
      router.push("/login"); return;
    }
    await persistDraft("manual");
  };

  const applySuggestedTimers = () => {
    let changed = 0;
    setQuestions((qs) => qs.map((q) => {
      if (!q.text.trim()) return q;
      const rec = getRecommendedTimeLimit(q.text);
      if (q.timeLimit === rec) return q;
      changed++;
      return { ...q, timeLimit: rec };
    }));
    if (changed > 0) { setSaveDraftNotice(`Updated ${changed} timer${changed === 1 ? "" : "s"}.`); setSaveDraftError(""); }
  };

  const handlePublish = async () => {
    const nqs = normalizeQuestions(questions);
    const bad = nqs.filter((q) => !isQuestionComplete(q)).length;
    if (!quizTitle.trim()) { setPublishError("Add a title before publishing."); return; }
    if (bad > 0) { setPublishError(bad === 1 ? "Complete the unfinished question before publishing." : `Complete all ${bad} unfinished questions before publishing.`); return; }
    if (authLoading) return;
    if (!user) {
      const redirect = remoteDraftId ? `/create?draft=${remoteDraftId}` : editingQuizId ? `/create?quiz=${editingQuizId}` : versionParam ? `/create?version=${versionParam}` : "/create";
      sessionStorage.setItem("qw_post_login_redirect", redirect);
      router.push("/login"); return;
    }
    setPublishing(true); setPublishError(""); setSaveDraftNotice("");
    try {
      const payload = {
        p_title: quizTitle.trim(), p_category: quizCategory,
        p_emoji: CATEGORY_EMOJIS[quizCategory] ?? "🧠", p_color: CATEGORY_COLORS[quizCategory] ?? "#8b5cf6",
        p_is_public: isPublic, p_questions: toPublishPayload(nqs),
      };
      const isRepublish = Boolean(editingQuizId);
      const { data, error } = isRepublish
        ? await supabase.rpc("republish_quiz", { p_quiz_id: editingQuizId, ...payload })
        : await supabase.rpc("publish_quiz", payload);
      if (error) throw error;
      const createdId = typeof data === "string" ? data : typeof data === "object" && data !== null && "quiz_id" in data ? String((data as { quiz_id: string }).quiz_id) : null;
      const vNum = typeof data === "object" && data !== null && "version_number" in data ? Number((data as { version_number: number }).version_number) : 1;
      if (!createdId) throw new Error(isRepublish ? "Failed to republish quiz." : "Failed to publish quiz.");
      if (remoteDraftId && user) await supabase.from("quiz_drafts").update({ quiz_id: createdId, updated_at: new Date().toISOString() }).eq("id", remoteDraftId).eq("owner_id", user.id);
      sessionStorage.removeItem(CREATE_DRAFT_KEY);
      router.push(isRepublish ? `/dashboard?updated=${createdId}&version=${vNum}` : `/dashboard?created=${createdId}`);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : editingQuizId ? "Failed to republish quiz." : "Failed to publish quiz.");
    } finally { setPublishing(false); }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadingRemoteSource) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="card p-10 text-center max-w-md w-full" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
          <div className="text-6xl mb-4">📝</div>
          <h1 className="font-display text-2xl font-black text-[var(--ink)] mb-2">Loading your quiz…</h1>
          <p className="font-medium text-[var(--muted)]">Pulling your saved content into the editor.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — AI LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === "ai-loading") {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="card p-10 text-center max-w-md w-full" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
          <div className="text-5xl mb-5">✨</div>
          <h1 className="font-display text-2xl font-black text-[var(--ink)] mb-2">Building your starter draft</h1>
          <p className="font-medium text-[var(--muted)] mb-6">{aiStatus}</p>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${aiProgress}%`, background: "linear-gradient(90deg, var(--accent), #a78bfa)" }} />
          </div>
          <p className="text-xs font-semibold text-[var(--muted)] mt-3">{Math.round(aiProgress)}%</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — SOURCE STEP
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === "source") {
    const sources: { id: SourceType; icon: string; label: string; desc: string }[] = [
      { id: "manual", icon: "✏️", label: "Manual", desc: "Write from scratch" },
      { id: "paste-text", icon: "📥", label: "Paste", desc: "Import formatted text" },
      { id: "ai-topic", icon: "💡", label: "Topic Starter", desc: "Generate a starter set" },
      { id: "ai-url", icon: "🔗", label: "From URL", desc: "Import from a web page" },
      { id: "ai-pdf", icon: "📄", label: "Document", desc: "Upload or paste text" },
    ];

    return (
      <div className="min-h-[calc(100vh-64px)] pb-24 relative z-10" style={{ background: "var(--bg)" }}>
        {/* Decorative blobs */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-40" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%)", top: "-100px", left: "-100px" }} />
          <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-30" style={{ background: "radial-gradient(circle, rgba(225,29,72,0.12), transparent 70%)", bottom: "0", right: "0" }} />
        </div>

        <div className="container max-w-3xl pt-14 px-4">
          {/* Header */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              ✦ Quiz Builder
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black text-[var(--ink)] leading-tight mb-3" style={{ letterSpacing: "-0.03em" }}>
              Create a new quiz
            </h1>
            <p className="text-lg font-medium text-[var(--muted)] max-w-xl mx-auto">
              Choose how you want to get started — every path leads to the same editor.
            </p>
          </div>

          {/* Source type tabs */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => setSourceType(s.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm transition-all duration-150"
                style={{
                  background: sourceType === s.id ? "var(--accent)" : "var(--surface)",
                  color: sourceType === s.id ? "#fff" : "var(--ink)",
                  border: sourceType === s.id ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                  boxShadow: sourceType === s.id ? "var(--shadow-md)" : "none",
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Active workspace card */}
          <div className="card p-7" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>

            {/* ── Manual ── */}
            {sourceType === "manual" && (
              <div className="text-center py-4">
                <div className="text-6xl mb-5">✏️</div>
                <h2 className="font-display text-2xl font-black text-[var(--ink)] mb-3">Manual Build</h2>
                <p className="font-medium text-[var(--muted)] mb-8 max-w-sm mx-auto">
                  Start with one blank card and build your quiz question by question. Full control over every word.
                </p>
                <button onClick={() => setStep("builder")} className="btn btn-primary btn-lg px-10">
                  Start Building →
                </button>
              </div>
            )}

            {/* ── Paste ── */}
            {sourceType === "paste-text" && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📥</span>
                  <div>
                    <h2 className="font-display text-xl font-black text-[var(--ink)]">Bulk Paste Import</h2>
                    <p className="text-sm font-medium text-[var(--muted)]">
                      Supports <code className="font-mono bg-[var(--bg)] px-1 rounded">* correct / - wrong</code> markers or <code className="font-mono bg-[var(--bg)] px-1 rounded">A./B./C./D. + Answer:</code> format
                    </p>
                  </div>
                </div>
                <textarea
                  value={textImport}
                  onChange={(e) => updateSourceText(e.target.value)}
                  placeholder={`What is the capital of France?\n* Paris\n- London\n- Berlin\n- Rome\ntime: 20\npoints: 1000\n\nQuestion 2: Which planet is known as the Red Planet?\nA. Venus\nB. Mars\nC. Jupiter\nD. Mercury\nAnswer: B`}
                  rows={11}
                  className="w-full rounded-xl p-4 font-medium outline-none resize-y mt-4"
                  style={{ border: "1.5px solid var(--line)", background: "var(--bg)", lineHeight: 1.6, minHeight: 260, fontFamily: "monospace", fontSize: "0.875rem" }}
                />
                {textImportError && (
                  <div className="rounded-xl p-3 mt-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    {textImportError}
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <button onClick={() => handleTextImport("paste-text")} disabled={!textImport.trim()} className="btn btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                    Import Draft →
                  </button>
                </div>
              </div>
            )}

            {/* ── Topic Starter ── */}
            {sourceType === "ai-topic" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">💡</span>
                  <div>
                    <h2 className="font-display text-xl font-black text-[var(--ink)]">Topic Starter</h2>
                    <p className="text-sm font-medium text-[var(--muted)]">Generate a first draft from a topic, then edit in the builder</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && startAIGeneration()}
                    placeholder="e.g. Solar System, World War II, Python basics…"
                    className="input flex-1"
                  />
                  <button onClick={startAIGeneration} disabled={!aiTopic.trim()} className="btn btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                    Generate ✨
                  </button>
                </div>
                <p className="text-xs font-semibold text-[var(--muted)] mt-3">
                  Try: "Ancient Rome" · "Machine Learning" · "Premier League 2024"
                </p>
              </div>
            )}

            {/* ── URL Import ── */}
            {sourceType === "ai-url" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">🔗</span>
                  <div>
                    <h2 className="font-display text-xl font-black text-[var(--ink)]">URL Import</h2>
                    <p className="text-sm font-medium text-[var(--muted)]">Fetch a page, review the text, then convert structured questions</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/quiz-source"
                    className="input flex-1"
                  />
                  <button onClick={handleUrlImport} disabled={!urlInput.trim() || urlImportLoading} className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed">
                    {urlImportLoading ? "Fetching…" : "Fetch Page"}
                  </button>
                </div>
                {urlImportError && <div className="rounded-xl p-3 mb-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{urlImportError}</div>}
                {textImportNotice && <div className="rounded-xl p-3 mb-3 text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{textImportNotice}</div>}
                <textarea
                  value={textImport}
                  onChange={(e) => updateSourceText(e.target.value)}
                  placeholder={`Fetched text appears here. Trim to question blocks only, then convert.\n\nQuestion 1: ...\nA. ...\nB. ...\nAnswer: A`}
                  rows={9}
                  className="w-full rounded-xl p-4 font-medium outline-none resize-y"
                  style={{ border: "1.5px solid var(--line)", background: "var(--bg)", lineHeight: 1.6, fontFamily: "monospace", fontSize: "0.875rem" }}
                />
                {textImportError && <div className="rounded-xl p-3 mt-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{textImportError}</div>}
                <div className="flex justify-end mt-4">
                  <button onClick={() => handleTextImport("ai-url")} disabled={!textImport.trim()} className="btn btn-secondary px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                    Convert To Quiz →
                  </button>
                </div>
              </div>
            )}

            {/* ── Document ── */}
            {sourceType === "ai-pdf" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">📄</span>
                  <div>
                    <h2 className="font-display text-xl font-black text-[var(--ink)]">Document Import</h2>
                    <p className="text-sm font-medium text-[var(--muted)]">Upload .txt/.md/.csv/.json/.html, or paste extracted PDF text</p>
                  </div>
                </div>
                <label className="flex items-center justify-between gap-4 p-4 rounded-xl cursor-pointer mb-4 transition-colors hover:bg-[var(--accent-light)]"
                  style={{ border: "1.5px dashed var(--accent)", background: "var(--surface)" }}>
                  <div>
                    <div className="font-bold text-sm text-[var(--ink)]">{documentImportName || "Choose a file to upload"}</div>
                    <div className="text-xs font-medium text-[var(--muted)] mt-0.5">PDF binaries not supported — paste text below instead</div>
                  </div>
                  <span className="btn btn-secondary btn-sm">Browse</span>
                  <input type="file" accept=".txt,.md,.csv,.json,.html,.htm" onChange={handleDocumentUpload} className="hidden" />
                </label>
                {textImportNotice && <div className="rounded-xl p-3 mb-3 text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{textImportNotice}</div>}
                <textarea
                  value={textImport}
                  onChange={(e) => { setSourceType("ai-pdf"); updateSourceText(e.target.value); }}
                  placeholder={`Paste extracted PDF text or document export here.\n\nQuestion 1: ...\nA. ...\nB. ...\nAnswer: A`}
                  rows={9}
                  className="w-full rounded-xl p-4 font-medium outline-none resize-y"
                  style={{ border: "1.5px solid var(--line)", background: "var(--bg)", lineHeight: 1.6, fontFamily: "monospace", fontSize: "0.875rem" }}
                />
                {textImportError && <div className="rounded-xl p-3 mt-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{textImportError}</div>}
                <div className="flex justify-end mt-4">
                  <button onClick={() => handleTextImport("ai-pdf")} disabled={!textImport.trim()} className="btn btn-secondary px-8 disabled:opacity-50 disabled:cursor-not-allowed">
                    Convert To Quiz →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Source Draft panel (available for URL/Doc/Paste when text is present) */}
          {(sourceType === "ai-url" || sourceType === "ai-pdf" || sourceType === "paste-text") && textImport.trim().length >= 50 && (
            <div className="card p-6 mt-4" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <h3 className="font-display font-bold text-lg text-[var(--ink)]">AI Source Draft</h3>
                    <p className="text-sm font-medium text-[var(--muted)]">Turn this source text into a cited quiz draft for review</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Questions:</span>
                  {([3, 5, 8, 10] as AIQuestionCount[]).map((count) => (
                    <button key={count} onClick={() => setAiQuestionCount(count)}
                      className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
                      style={{
                        background: aiQuestionCount === count ? "var(--accent)" : "var(--bg)",
                        color: aiQuestionCount === count ? "#fff" : "var(--ink)",
                        border: `1px solid ${aiQuestionCount === count ? "var(--accent)" : "var(--line)"}`,
                      }}>
                      {count}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={sourceMaterialTitle}
                  onChange={(e) => setSourceMaterialTitle(e.target.value)}
                  placeholder="Source title (for citations)"
                  className="input flex-1"
                />
                <button onClick={generateAIDraftFromSource} disabled={aiDraftLoading}
                  className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                  {aiDraftLoading ? "Generating…" : "Generate AI Draft ✨"}
                </button>
              </div>
              {aiDraftError && <div className="rounded-xl p-3 mt-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{aiDraftError}</div>}
              {aiDraftReview && (
                <div className="mt-5 rounded-2xl p-5" style={{ border: "1px solid var(--line)", background: "linear-gradient(180deg, var(--surface), var(--bg-subtle))" }}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">AI Review Draft</div>
                      <h3 className="font-display text-xl font-black text-[var(--ink)]">{aiDraftReview.title}</h3>
                      <p className="text-sm font-medium text-[var(--muted)] mt-1">{aiDraftReview.summary}</p>
                    </div>
                    <button onClick={loadAIDraftIntoBuilder} className="btn btn-primary btn-sm whitespace-nowrap">Load Into Builder →</button>
                  </div>
                  <div className="grid gap-3">
                    {aiDraftReview.questions.map((q, i) => (
                      <div key={i} className="rounded-xl p-4" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Q{i + 1}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: q.confidence === "high" ? "var(--success-light)" : q.confidence === "medium" ? "var(--secondary-light)" : "var(--primary-light)", color: q.confidence === "high" ? "var(--success)" : q.confidence === "medium" ? "var(--secondary)" : "var(--primary)" }}>
                            {q.confidence} confidence
                          </span>
                        </div>
                        <p className="font-display font-bold text-[var(--ink)] mb-3">{q.text}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {q.answers.map((a, ai) => (
                            <div key={ai} className="rounded-lg px-3 py-2 text-sm font-medium"
                              style={{ background: a.is_correct ? "var(--success-light)" : "var(--bg)", border: `1px solid ${a.is_correct ? "var(--success)" : "var(--line)"}`, color: "var(--ink)" }}>
                              {a.text}
                            </div>
                          ))}
                        </div>
                        {q.rationale && <p className="text-xs font-medium text-[var(--muted)] mt-2 italic">{q.rationale}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — PUBLISH STEP
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === "publish") {
    const categoryEmoji = CATEGORY_EMOJIS[quizCategory] ?? "🧠";
    const categoryColor = CATEGORY_COLORS[quizCategory] ?? "#8b5cf6";

    return (
      <div className="min-h-[calc(100vh-64px)] pb-24 relative z-10" style={{ background: "var(--bg)" }}>
        {/* Sticky header */}
        <div className="sticky top-16 z-50 border-b glass-strong" style={{ borderColor: "var(--line)" }}>
          <div className="container max-w-5xl h-14 flex items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("builder")} className="btn btn-secondary btn-sm gap-1.5">
                ← Back to Builder
              </button>
              <div className="h-4 w-px" style={{ background: "var(--line)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Step 3 of 3 · Publish
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: draftStatusMeta.bg, color: draftStatusMeta.tone }}>
                {draftStatusMeta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="container max-w-5xl px-4 pt-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left: form */}
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                  🚀 Almost there
                </div>
                <h1 className="font-display text-3xl font-black text-[var(--ink)] mb-1" style={{ letterSpacing: "-0.02em" }}>
                  {editingQuizId ? "Republish quiz" : "Publish your quiz"}
                </h1>
                <p className="font-medium text-[var(--muted)]">
                  Set the details, check the quality flags, then go live.
                </p>
              </div>

              {/* Notices */}
              {saveDraftNotice && (
                <div className="rounded-xl p-4 text-sm font-semibold" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                  {saveDraftNotice}
                </div>
              )}
              {publishError && (
                <div className="rounded-xl p-4 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                  {publishError}
                </div>
              )}
              {editingQuizId && !remoteDraftId && (
                <div className="rounded-xl p-4 text-sm font-semibold" style={{ background: "var(--secondary-light)", color: "var(--secondary)" }}>
                  You are editing a published quiz snapshot. Save it as a draft before republishing to preserve the current live version.
                </div>
              )}

              <div className="card p-6 space-y-6" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
                {/* Title */}
                <div>
                  <label className="block font-display font-bold text-xs uppercase tracking-widest text-[var(--muted)] mb-2">
                    Quiz Title *
                  </label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="Give your quiz an epic name…"
                    className="input input-lg w-full"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block font-display font-bold text-xs uppercase tracking-widest text-[var(--muted)] mb-3">
                    Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setQuizCategory(cat)}
                        className="rounded-xl p-3 text-sm font-bold transition-all duration-150 flex flex-col items-center gap-1"
                        style={{
                          background: quizCategory === cat ? CATEGORY_COLORS[cat] + "15" : "var(--bg)",
                          border: quizCategory === cat ? `1.5px solid ${CATEGORY_COLORS[cat]}` : "1.5px solid var(--line)",
                          color: quizCategory === cat ? CATEGORY_COLORS[cat] : "var(--ink)",
                        }}>
                        <span className="text-xl">{CATEGORY_EMOJIS[cat]}</span>
                        <span className="text-xs leading-tight text-center">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block font-display font-bold text-xs uppercase tracking-widest text-[var(--muted)] mb-3">
                    Visibility
                  </label>
                  <div className="flex gap-3">
                    {[
                      { value: true, label: "Public", desc: "Listed in Explore", icon: "🌍" },
                      { value: false, label: "Private", desc: "Only accessible by link", icon: "🔒" },
                    ].map((opt) => (
                      <button key={String(opt.value)} onClick={() => setIsPublic(opt.value)}
                        className="flex-1 rounded-xl p-4 text-left transition-all duration-150"
                        style={{
                          background: isPublic === opt.value ? "var(--accent-light)" : "var(--bg)",
                          border: isPublic === opt.value ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                        }}>
                        <div className="text-2xl mb-1">{opt.icon}</div>
                        <div className="font-display font-bold text-sm text-[var(--ink)]">{opt.label}</div>
                        <div className="text-xs font-medium text-[var(--muted)]">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality checklist */}
              <div className="card p-5" style={{ border: "1px solid var(--line)" }}>
                <h3 className="font-display font-bold text-base text-[var(--ink)] mb-3">Pre-publish checklist</h3>
                <div className="space-y-2">
                  {[
                    { ok: validCount === questions.length, label: `${validCount} of ${questions.length} questions complete` },
                    { ok: placeholderCount === 0, label: placeholderCount === 0 ? "No placeholder copy detected" : `${placeholderCount} question${placeholderCount === 1 ? "" : "s"} still have starter copy` },
                    { ok: timingRiskCount === 0, label: timingRiskCount === 0 ? "Timers look good" : `${timingRiskCount} question${timingRiskCount === 1 ? "" : "s"} may need longer timers` },
                    { ok: Boolean(quizTitle.trim()), label: quizTitle.trim() ? "Quiz title set" : "Title is required" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ background: item.ok ? "var(--success-light)" : "var(--primary-light)", color: item.ok ? "var(--success)" : "var(--primary)" }}>
                        {item.ok ? "✓" : "!"}
                      </div>
                      <span className="text-sm font-medium" style={{ color: item.ok ? "var(--ink)" : "var(--primary)" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                {suggestedTimerCount > 0 && (
                  <button onClick={applySuggestedTimers} className="btn btn-secondary btn-sm mt-4">
                    Apply Suggested Timers
                  </button>
                )}
              </div>

              {/* Publish CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePublish}
                  disabled={publishing || incompleteCount > 0 || !quizTitle.trim()}
                  className="btn btn-primary btn-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing ? "Publishing…" : editingQuizId ? "Republish Quiz 🚀" : "Publish Quiz 🚀"}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || !hasAnyDraftContent}
                  className="btn btn-secondary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingDraft ? "Saving…" : "Save Draft"}
                </button>
              </div>
            </div>

            {/* Right: quiz preview card + stats */}
            <div className="space-y-4">
              {/* Visual preview card */}
              <div
                className="rounded-2xl p-6 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${categoryColor}22 0%, ${categoryColor}08 100%)`,
                  border: `1.5px solid ${categoryColor}40`,
                }}
              >
                <div className="text-5xl mb-3">{categoryEmoji}</div>
                <div className="font-display text-xl font-black text-[var(--ink)] leading-tight mb-1">
                  {quizTitle || "Untitled Quiz"}
                </div>
                <div className="text-sm font-semibold" style={{ color: categoryColor }}>{quizCategory}</div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.8)", color: "var(--ink)" }}>
                    {questions.length} question{questions.length === 1 ? "" : "s"}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.8)", color: "var(--ink)" }}>
                    ~{Math.max(1, Math.ceil(estimatedDurationSeconds / 60))} min
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.8)", color: "var(--ink)" }}>
                    {isPublic ? "🌍 Public" : "🔒 Private"}
                  </span>
                </div>
                <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-30" style={{ background: categoryColor }} />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Ready", value: validCount, color: "var(--success)", bg: "var(--success-light)" },
                  { label: "Needs Work", value: incompleteCount, color: incompleteCount > 0 ? "var(--primary)" : "var(--muted)", bg: incompleteCount > 0 ? "var(--primary-light)" : "var(--bg)" },
                  { label: "Warnings", value: warningCount, color: warningCount > 0 ? "#c2410c" : "var(--muted)", bg: warningCount > 0 ? "#fff7ed" : "var(--bg)" },
                  { label: "Est. Time", value: `${Math.max(1, Math.ceil(estimatedDurationSeconds / 60))}m`, color: "var(--secondary)", bg: "var(--secondary-light)" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg, border: "1px solid var(--line)" }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>{s.label}</div>
                    <div className="font-display text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Preview first complete question */}
              {completeQuestions.length > 0 && (
                <div className="card p-4" style={{ border: "1px solid var(--line)" }}>
                  <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Question Preview</div>
                  <p className="font-display font-bold text-[var(--ink)] text-sm mb-3">{completeQuestions[0].text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {completeQuestions[0].answers.map((a, i) => (
                      <div key={a.id} className="rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2"
                        style={{ background: a.isCorrect ? "var(--success-light)" : "var(--bg)", border: `1px solid ${a.isCorrect ? "var(--success)" : "var(--line)"}`, color: "var(--ink)" }}>
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background: ANSWER_COLORS[i] }}>{ANSWER_ICONS[i]}</span>
                        {a.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — BUILDER STEP
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div
        className="flex-shrink-0 border-b flex items-center gap-3 px-4"
        style={{ background: "var(--surface)", borderColor: "var(--line)", height: 56 }}
      >
        {/* Back */}
        <button onClick={() => setStep("source")} className="btn btn-ghost btn-sm gap-1 text-[var(--muted)] hover:text-[var(--ink)]">
          ← Source
        </button>
        <div className="h-5 w-px flex-shrink-0" style={{ background: "var(--line)" }} />

        {/* Inline title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              placeholder="Untitled Quiz"
              className="font-display font-bold text-base text-[var(--ink)] outline-none bg-transparent w-full"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 0); }}
              className="font-display font-bold text-base text-[var(--ink)] hover:text-[var(--accent)] transition-colors truncate block text-left w-full"
              title="Click to rename"
            >
              {quizTitle || <span style={{ color: "var(--muted)" }}>Untitled Quiz</span>}
              <span className="ml-1.5 text-xs text-[var(--muted)]">✎</span>
            </button>
          )}
        </div>

        {/* Draft status pill */}
        <span
          className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-bold flex-shrink-0"
          style={{ background: draftStatusMeta.bg, color: draftStatusMeta.tone }}
        >
          {draftStatusMeta.label}
        </span>

        {/* Step indicator */}
        <div className="hidden md:flex items-center gap-1 text-xs font-semibold text-[var(--muted)] flex-shrink-0">
          <span className="px-2 py-1 rounded-md" style={{ background: "var(--bg)" }}>1 Source ✓</span>
          <span>›</span>
          <span className="px-2 py-1 rounded-md font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>2 Build</span>
          <span>›</span>
          <span className="px-2 py-1 rounded-md">3 Publish</span>
        </div>

        <div className="h-5 w-px flex-shrink-0" style={{ background: "var(--line)" }} />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft || draftSyncState === "saving" || !hasAnyDraftContent}
            className="btn btn-secondary btn-sm disabled:opacity-40 disabled:cursor-not-allowed hidden sm:flex"
          >
            {savingDraft || draftSyncState === "saving" ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={() => setShowPreview((v) => !v)}
            disabled={completeQuestions.length === 0}
            className="btn btn-secondary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={showPreview ? { background: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent)" } : {}}
          >
            <span className="sm:hidden">{showPreview ? "Hide" : "Preview"}</span>
            <span className="hidden sm:inline">{showPreview ? "Hide Preview" : "Preview"}</span>
          </button>
          <button
            onClick={() => setStep("publish")}
            disabled={validCount === 0}
            className="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Publish →
          </button>
        </div>
      </div>

      {/* ── Main builder area ── */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">

        {/* ── Left sidebar: question list ── */}
        <div
          className="flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r overflow-hidden w-full lg:w-[220px]"
          style={{
            borderColor: "var(--line)",
            background: "var(--surface)",
          }}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--line)" }}>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Questions</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                {validCount}
              </span>
              <span className="text-xs text-[var(--muted)]">/ {questions.length}</span>
            </div>
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-2 flex lg:block gap-2 lg:space-y-1">
            {questions.map((q, i) => (
              <SidebarItem
                key={q.id}
                question={q}
                index={i}
                total={questions.length}
                isActive={i === safeActiveIdx}
                issueCount={(questionIssues[i] ?? []).filter((iss) => iss.severity === "error").length}
                isComplete={isQuestionComplete(normalizedQs[i] ?? q)}
                onClick={() => { setActiveQuestionIndex(i); setShowPreview(false); }}
                onMove={(direction) => moveQuestion(i, direction)}
              />
            ))}
          </div>

          {/* Add question buttons */}
          <div className="flex-shrink-0 p-2 border-t space-y-1" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={addQuestion}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 hover:bg-[var(--accent-light)] text-[var(--accent)]"
              style={{ border: "1px dashed var(--accent)" }}
            >
              <span className="text-base">+</span>
              <span>Blank Question</span>
            </button>
            <button
              onClick={addTrueFalse}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 hover:bg-[var(--bg)] text-[var(--muted)]"
              style={{ border: "1px solid var(--line)" }}
            >
              <span>T/F Starter</span>
            </button>
          </div>
        </div>

        {/* ── Center: focused question editor ── */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {/* Banners */}
          <div className="px-6 pt-4 space-y-2">
            {saveDraftNotice && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                <span>{saveDraftNotice}{remoteDraftUpdatedAt ? ` · Saved ${new Date(remoteDraftUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
                <button onClick={() => setSaveDraftNotice("")} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
              </div>
            )}
            {saveDraftError && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{saveDraftError}</div>
            )}
            {draftSyncState === "error" && !saveDraftError && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>{draftSyncError}</div>
            )}
            {editingQuizId && !remoteDraftId && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--secondary-light)", color: "var(--secondary)" }}>
                Editing a published quiz snapshot. Save as draft before republishing.
              </div>
            )}
            {restoredDraft && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3" style={{ background: "var(--accent-light)", color: "var(--ink)" }}>
                <span>Recovered your last session from this browser.</span>
                <button onClick={resetBuilder} className="btn btn-secondary btn-sm">Start Fresh</button>
              </div>
            )}
          </div>

          {/* Preview mode */}
          {showPreview && (
            <div className="px-6 pt-4">
              <div className="card p-6" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Playtest Preview</div>
                    <h2 className="font-display text-xl font-black text-[var(--ink)]">
                      {previewQuestion ? `Question ${previewIndex + 1} of ${completeQuestions.length}` : "Complete a question to preview"}
                    </h2>
                  </div>
                  {previewQuestion && (
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: "var(--secondary-light)", color: "var(--secondary)" }}>⏱ {previewQuestion.timeLimit}s</span>
                      <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: "#fff7ed", color: "#c2410c" }}>⭐ {previewQuestion.points}</span>
                    </div>
                  )}
                </div>
                {previewQuestion ? (
                  <>
                    <div className="rounded-2xl p-5 mb-4" style={{ background: "linear-gradient(135deg, var(--surface), var(--bg-subtle))", border: "1px solid var(--line)" }}>
                      <p className="font-display text-xl font-black text-[var(--ink)] leading-tight">{previewQuestion.text}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {previewQuestion.answers.map((a, idx) => {
                        const sel = previewSelections[previewQuestion.id] === a.id;
                        const rev = Boolean(previewSelections[previewQuestion.id]);
                        return (
                          <button
                            key={a.id}
                            onClick={() => setPreviewSelections((c) => ({ ...c, [previewQuestion.id]: a.id }))}
                            className="text-left rounded-2xl p-4 transition-all duration-150"
                            style={{
                              background: rev ? (a.isCorrect ? "#ecfdf5" : sel ? "#fff1f2" : "var(--surface)") : "var(--surface)",
                              border: rev ? (a.isCorrect ? "1.5px solid #10b981" : sel ? "1.5px solid #e11d48" : "1.5px solid var(--line)") : sel ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0" style={{ background: ANSWER_COLORS[idx] }}>{ANSWER_ICONS[idx]}</div>
                              <span className="font-bold text-[var(--ink)] text-sm">{a.text}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {previewAnswer && previewCorrectAnswer && (
                      <div className="rounded-xl p-3 mt-4 text-sm font-semibold" style={{ background: previewAnswer.isCorrect ? "var(--success-light)" : "var(--primary-light)", color: previewAnswer.isCorrect ? "var(--success)" : "var(--primary)" }}>
                        {previewAnswer.isCorrect ? "Correct ✓" : `Incorrect. Correct answer: "${previewCorrectAnswer.text}"`}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-5">
                      <button onClick={() => setPreviewIndex((c) => Math.max(c - 1, 0))} disabled={previewIndex === 0} className="btn btn-secondary btn-sm disabled:opacity-40">← Prev</button>
                      <button onClick={() => setPreviewSelections((c) => { const n = { ...c }; if (previewQuestion) delete n[previewQuestion.id]; return n; })} className="btn btn-secondary btn-sm">Clear</button>
                      <button onClick={() => setPreviewIndex((c) => Math.min(c + 1, completeQuestions.length - 1))} disabled={previewIndex >= completeQuestions.length - 1} className="btn btn-primary btn-sm disabled:opacity-40">Next →</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-[var(--muted)] py-4">Finish at least one full question to preview.</p>
                )}
              </div>
            </div>
          )}

          {/* Active question editor */}
          {!showPreview && activeQuestion && (
            <div className="px-6 pt-4 pb-6">
              <div className="card p-6" style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
                <QuestionEditor
                  question={activeQuestion}
                  index={safeActiveIdx}
                  total={questions.length}
                  issues={activeIssues}
                  onChange={(q) => updateQuestion(safeActiveIdx, q)}
                  onDelete={() => deleteQuestion(safeActiveIdx)}
                  onDuplicate={() => duplicateQuestion(safeActiveIdx)}
                  onMove={(direction) => moveQuestion(safeActiveIdx, direction)}
                />
              </div>

              {/* Prev / Next navigation */}
	              <div className="flex items-center justify-between mt-4">
	                <button
	                  onClick={() => setActiveQuestionIndex((i) => Math.max(i - 1, 0))}
                  disabled={safeActiveIdx === 0}
                  className="btn btn-secondary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-[var(--muted)]">
                  {safeActiveIdx + 1} / {questions.length}
                </span>
                <button
                  onClick={() => {
                    if (safeActiveIdx < questions.length - 1) {
                      setActiveQuestionIndex(safeActiveIdx + 1);
                    } else {
                      addQuestion();
                    }
                  }}
                  className="btn btn-primary btn-sm"
                >
	                  {safeActiveIdx < questions.length - 1 ? "Next →" : "+ Add Question"}
	                </button>
	              </div>

	              <div className="lg:hidden mt-5 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
	                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Question Settings</div>
	                <div className="space-y-4">
	                  <div>
	                    <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">⏱ Time</div>
	                    <div className="grid grid-cols-4 gap-2">
	                      {TIME_OPTIONS.map((t) => (
	                        <button
	                          key={t}
	                          onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, timeLimit: t })}
	                          className="py-2 rounded-lg text-sm font-bold transition-all duration-150"
	                          style={{
	                            background: activeQuestion.timeLimit === t ? "var(--accent)" : "var(--bg)",
	                            color: activeQuestion.timeLimit === t ? "#fff" : "var(--ink)",
	                            border: activeQuestion.timeLimit === t ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
	                          }}
	                        >
	                          {t}s
	                        </button>
	                      ))}
	                    </div>
	                    {getRecommendedTimeLimit(activeQuestion.text) !== activeQuestion.timeLimit && activeQuestion.text.trim() && (
	                      <button
	                        onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, timeLimit: getRecommendedTimeLimit(activeQuestion.text) })}
	                        className="w-full mt-2 py-2 rounded-lg text-xs font-bold text-[var(--accent)] transition-all"
	                        style={{ background: "var(--accent-light)", border: "none" }}
	                      >
	                        Suggest: {getRecommendedTimeLimit(activeQuestion.text)}s
	                      </button>
	                    )}
	                  </div>

	                  <div>
	                    <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">⭐ Points</div>
	                    <div className="grid grid-cols-3 gap-2">
	                      {POINT_OPTIONS.map((pt) => (
	                        <button
	                          key={pt}
	                          onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, points: pt })}
	                          className="py-2 rounded-lg text-sm font-bold transition-all duration-150"
	                          style={{
	                            background: activeQuestion.points === pt ? "#d97706" : "var(--bg)",
	                            color: activeQuestion.points === pt ? "#fff" : "var(--ink)",
	                            border: activeQuestion.points === pt ? "1.5px solid #d97706" : "1.5px solid var(--line)",
	                          }}
	                        >
	                          {pt}
	                        </button>
	                      ))}
	                    </div>
	                  </div>
	                </div>
	              </div>
	            </div>
	          )}
	        </div>

        {/* ── Right panel: timer + points ── */}
        <div
          className="flex-shrink-0 border-l overflow-y-auto hidden lg:flex flex-col gap-5 p-4"
          style={{ width: 180, borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {activeQuestion && !showPreview && (
            <>
              {/* Timer */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2.5">⏱ Time</div>
                <div className="flex flex-col gap-1.5">
                  {TIME_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, timeLimit: t })}
                      className="w-full py-2 rounded-lg text-sm font-bold transition-all duration-150"
                      style={{
                        background: activeQuestion.timeLimit === t ? "var(--accent)" : "var(--bg)",
                        color: activeQuestion.timeLimit === t ? "#fff" : "var(--ink)",
                        border: activeQuestion.timeLimit === t ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                      }}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
                {getRecommendedTimeLimit(activeQuestion.text) !== activeQuestion.timeLimit && activeQuestion.text.trim() && (
                  <button
                    onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, timeLimit: getRecommendedTimeLimit(activeQuestion.text) })}
                    className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold text-[var(--accent)] transition-all"
                    style={{ background: "var(--accent-light)", border: "none" }}
                  >
                    Suggest: {getRecommendedTimeLimit(activeQuestion.text)}s
                  </button>
                )}
              </div>

              <div className="h-px" style={{ background: "var(--line)" }} />

              {/* Points */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2.5">⭐ Points</div>
                <div className="flex flex-col gap-1.5">
                  {POINT_OPTIONS.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => updateQuestion(safeActiveIdx, { ...activeQuestion, points: pt })}
                      className="w-full py-2 rounded-lg text-sm font-bold transition-all duration-150"
                      style={{
                        background: activeQuestion.points === pt ? "#d97706" : "var(--bg)",
                        color: activeQuestion.points === pt ? "#fff" : "var(--ink)",
                        border: activeQuestion.points === pt ? "1.5px solid #d97706" : "1.5px solid var(--line)",
                      }}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: "var(--line)" }} />

              {/* Quick stats */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Quiz Stats</div>
                <div className="rounded-xl p-3 text-center" style={{ background: "var(--success-light)" }}>
                  <div className="font-display text-xl font-black" style={{ color: "var(--success)" }}>{validCount}</div>
                  <div className="text-xs font-semibold" style={{ color: "var(--success)" }}>Ready</div>
                </div>
                {incompleteCount > 0 && (
                  <div className="rounded-xl p-3 text-center" style={{ background: "var(--primary-light)" }}>
                    <div className="font-display text-xl font-black" style={{ color: "var(--primary)" }}>{incompleteCount}</div>
                    <div className="text-xs font-semibold" style={{ color: "var(--primary)" }}>To Fix</div>
                  </div>
                )}
                <div className="rounded-xl p-3 text-center" style={{ background: "var(--secondary-light)" }}>
                  <div className="font-display text-xl font-black" style={{ color: "var(--secondary)" }}>
                    {Math.max(1, Math.ceil(estimatedDurationSeconds / 60))}m
                  </div>
                  <div className="text-xs font-semibold" style={{ color: "var(--secondary)" }}>Est. Time</div>
                </div>
              </div>
            </>
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
