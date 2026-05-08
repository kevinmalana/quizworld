"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function ShareButton({ quizId, quizTitle }: { quizId: string; quizTitle: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/study/${quizId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      title={`Share "${quizTitle}"`}
      style={{
        background: copied ? "var(--success-light)" : "var(--bg)",
        border: `1px solid ${copied ? "var(--success)" : "var(--line)"}`,
        borderRadius: "var(--radius-lg)",
        color: copied ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copied" : "Share"}
    </button>
  );
}
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import { CATEGORY_EMOJIS } from "@/lib/store";

type StudyProgressRow = {
  quiz_id: string;
  questions_studied: number;
  correct: number;
  mastery: number;
  last_studied: string;
};

type StudySessionRow = {
  id: string;
  xp_earned: number;
  correct: number;
  total: number;
  study_mode: string;
  duration_secs: number | null;
  created_at: string;
};

type QuizRow = {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  questions?: { count: number }[];
};

// ─── XP & Level helpers ────────────────────────────────────────────────────────

const XP_PER_CORRECT = 25;
const XP_BONUS_COMPLETION = 50; // bonus when finishing all questions in a quiz
const XP_BONUS_PERFECT = 100;   // bonus for 100% accuracy
const XP_BONUS_QUICKFIRE = 20;   // extra per correct in quickfire mode

function calcLevel(totalXp: number) {
  // Each level needs level * 200 XP (level 1 = 200, level 2 = 400, ...)
  // totalXp = sum_{i=1}^{L-1} i*200 + remainder
  // Solve: (L-1)*L/2 * 200 <= totalXp < L*(L+1)/2 * 200
  let level = 1;
  let xpNeeded = 200;
  while (totalXp >= xpNeeded) {
    level++;
    xpNeeded += level * 200;
  }
  const prevLevelXp = (level - 1) * level * 100; // sum of first (level-1) terms of i*200
  const levelStartXp = prevLevelXp;
  const levelEndXp = level * (level + 1) * 100;
  const progress = ((totalXp - levelStartXp) / (levelEndXp - levelStartXp)) * 100;
  return {
    level,
    progress: Math.min(100, Math.max(0, progress)),
    currentXp: totalXp - levelStartXp,
    xpToNext: levelEndXp - totalXp,
  };
}

function calcSessionXp(correct: number, total: number, mode: string, durationSecs: number | null) {
  let xp = correct * XP_PER_CORRECT;
  if (mode === "quickfire") xp += correct * XP_BONUS_QUICKFIRE;
  if (correct === total && total > 0) xp += XP_BONUS_COMPLETION;
  if (total > 0 && correct / total === 1) xp += XP_BONUS_PERFECT;
  return xp;
}

// ─── Mastery bar chart ──────────────────────────────────────────────────────────

function MasteryBarChart({ progress }: { progress: StudyProgressRow[] }) {
  if (progress.length === 0) return null;

  const buckets = [
    { label: "0–20%", min: 0, max: 20, color: "#ef4444" },
    { label: "21–40%", min: 21, max: 40, color: "#f97316" },
    { label: "41–60%", min: 41, max: 60, color: "#eab308" },
    { label: "61–80%", min: 61, max: 80, color: "#3b82f6" },
    { label: "81–100%", min: 81, max: 100, color: "#22c55e" },
  ];

  const counts = buckets.map(() => 0);
  for (const entry of progress) {
    const m = entry.mastery ?? 0;
    const bucket = buckets.findIndex((b) => m >= b.min && m <= b.max);
    if (bucket >= 0) counts[bucket]++;
  }

  const maxCount = Math.max(...counts, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {buckets.map((bucket, i) => {
        const count = counts[i];
        const pct = (count / maxCount) * 100;
        return (
          <div key={bucket.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 52, fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
              {bucket.label}
            </div>
            <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: bucket.color,
                  borderRadius: 999,
                  transition: "width 0.4s ease",
                  minWidth: count > 0 ? 8 : 0,
                }}
              />
            </div>
            <div style={{ width: 24, fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", flexShrink: 0, textAlign: "right" }}>
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── XP progress bar ───────────────────────────────────────────────────────────

function XpProgressBar({ totalXp }: { totalXp: number }) {
  const { level, progress, currentXp, xpToNext } = useMemo(() => calcLevel(totalXp), [totalXp]);

  return (
    <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)", background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>⭐</span>
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>Level {level}</span>
        </div>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>
          {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
        </span>
      </div>
      <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
            borderRadius: 999,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>
        {Math.round(progress)}% to Level {level + 1}
      </div>
    </div>
  );
}

// ─── Streak display ─────────────────────────────────────────────────────────────

function StreakBadge({ streak, longest }: { streak: number; longest: number }) {
  const isActive = streak > 0;
  return (
    <div className="card" style={{ padding: "1rem 1.25rem", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "1.1rem" }}>{isActive ? "🔥" : "💤"}</span>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{streak}</span>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>day streak</span>
      </div>
      {longest > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          Personal best: {longest} days
        </div>
      )}
    </div>
  );
}

// ─── XP history sparkline ──────────────────────────────────────────────────────

function XpHistorySparkline({ sessions }: { sessions: StudySessionRow[] }) {
  const last7Days = useMemo(() => {
    const days: { label: string; xp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        xp: sessions
          .filter((s) => s.created_at?.startsWith(iso))
          .reduce((sum, s) => sum + (s.xp_earned ?? 0), 0),
      });
    }
    return days;
  }, [sessions]);

  const maxXp = Math.max(...last7Days.map((d) => d.xp), 1);

  return (
    <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "1rem" }}>
        XP Earned — Last 7 Days
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: 64 }}>
        {last7Days.map((day, i) => {
          const height = Math.round((day.xp / maxXp) * 56) + 4;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
              <div
                style={{
                  width: "100%",
                  height,
                  borderRadius: "6px 6px 0 0",
                  background: day.xp > 0 ? "linear-gradient(180deg, #8b5cf6, #a78bfa)" : "var(--bg)",
                  border: day.xp > 0 ? "none" : "1px solid var(--line)",
                  transition: "height 0.3s ease",
                }}
                title={`${day.xp} XP`}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
        {last7Days.map((day, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: "var(--muted)" }}>
            {day.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function StudyListPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [progress, setProgress] = useState<StudyProgressRow[]>([]);
  const [sessions, setSessions] = useState<StudySessionRow[]>([]);
  const [profile, setProfile] = useState<{ total_xp: number; study_streak: number; longest_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setQuizError(null);

      const quizQuery = supabase
        .from("quizzes")
        .select("id, title, emoji, color, category, questions(count)")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: quizData, error: quizError } = user
        ? await quizQuery.or(`is_public.eq.true,creator_id.eq.${user.id}`)
        : await quizQuery.eq("is_public", true);

      if (ignore) return;

      if (quizError) {
        console.error("Error loading study quizzes:", quizError);
        setQuizError("Could not load study sets. Please try again.");
        setQuizzes([]);
      } else {
        setQuizzes(quizData ?? []);
      }

      if (!user) {
        if (!ignore) { setProgress([]); setSessions([]); setLoading(false); }
        return;
      }

      const [progressResult, profileResult] = await Promise.all([
        supabase
          .from("study_progress")
          .select("quiz_id, questions_studied, correct, mastery, last_studied")
          .eq("user_id", user.id)
          .order("last_studied", { ascending: false }),
        // Select the full profile row so Study Hall still loads if optional XP/streak
        // columns have not been deployed to the live Supabase schema yet.
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),
      ]);

      if (ignore) return;

      if (progressResult.error) {
        console.error("Error loading study progress:", progressResult.error);
      } else {
        setProgress(progressResult.data ?? []);
      }

      setSessions([]);

      if (profileResult.data) {
        setProfile(profileResult.data as any);
      }

      setLoading(false);
    }

    fetchData();
    return () => { ignore = true; };
  }, [user?.id]);

  const progressByQuizId = useMemo(
    () => new Map(progress.map((entry) => [entry.quiz_id, entry])),
    [progress]
  );

  const studiedQuizzes = quizzes.filter((quiz) => progressByQuizId.has(quiz.id));
  const availableQuizzes = quizzes.filter((quiz) => !progressByQuizId.has(quiz.id));

  // Aggregate stats
  const totalCorrect = progress.reduce((s, p) => s + (p.correct ?? 0), 0);
  const totalStudied = progress.reduce((s, p) => s + (p.questions_studied ?? 0), 0);
  const avgMastery = progress.length
    ? Math.round(progress.reduce((s, p) => s + (p.mastery ?? 0), 0) / progress.length)
    : 0;
  const accuracyRate = totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0;
  const totalXp = profile?.total_xp ?? 0;
  const streak = profile?.study_streak ?? 0;
  const longestStreak = profile?.longest_streak ?? 0;
  const totalSessionXp = sessions.reduce((s, sess) => s + (sess.xp_earned ?? 0), 0);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📡</div>
        <p style={{ color: "var(--muted)" }}>Loading study sets...</p>
      </div>
    );
  }

  if (quizError) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center", border: "2px dashed var(--line-strong)", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
            Could not load study sets
          </h3>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>{quizError}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: "1.25rem" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: "var(--bg)", paddingBottom: "5rem" }}>
      <div className="container" style={{ paddingTop: "3rem" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              🧠 Study Hall
            </h1>
            <p style={{ color: "var(--muted)" }}>
              Master your knowledge with flashcards and quickfire practice.
            </p>
          </div>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--accent-light)", padding: "0.5rem 1rem", borderRadius: 999 }}>
              <span style={{ fontSize: "1.1rem" }}>⭐</span>
              <span style={{ fontWeight: 800, color: "var(--accent)" }}>{totalXp.toLocaleString()} XP</span>
            </div>
          )}
        </div>

        {!user && (
          <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "2rem", border: "1px solid var(--line)", background: "var(--accent-light)" }}>
            Sign in to save study progress and earn XP across sessions.
          </div>
        )}

        {/* ── Stats dashboard (only when logged in) ── */}
        {user && (
          <>
            {/* XP progress + streak */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "1.5rem", alignItems: "stretch" }}>
              <XpProgressBar totalXp={totalXp} />
              <StreakBadge streak={streak} longest={longestStreak} />
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>📚</div>
                <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "var(--accent)" }}>{studiedQuizzes.length}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Quizzes Studied</div>
              </div>
              <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🎯</div>
                <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "var(--secondary)" }}>{avgMastery}%</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Avg Mastery</div>
              </div>
              <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>✅</div>
                <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "var(--success)" }}>{accuracyRate}%</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Accuracy</div>
              </div>
              <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>⚡</div>
                <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "#8b5cf6" }}>+{totalSessionXp.toLocaleString()}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Session XP</div>
              </div>
            </div>

            {/* Mastery distribution + XP sparkline */}
            {progress.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "1rem" }}>
                    Mastery Distribution
                  </div>
                  <MasteryBarChart progress={progress} />
                </div>
                {sessions.length > 0 && (
                  <XpHistorySparkline sessions={sessions} />
                )}
              </div>
            )}
          </>
        )}

        {/* ── Continue Studying ── */}
        {studiedQuizzes.length > 0 && (
          <>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>Continue Studying</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
              {studiedQuizzes.map((quiz) => {
                const quizProgress = progressByQuizId.get(quiz.id);
                const questionCount = quiz.questions?.[0]?.count ?? 0;
                const masteryColor = (quizProgress?.mastery ?? 0) >= 80
                  ? "var(--success)"
                  : (quizProgress?.mastery ?? 0) >= 50
                    ? "#eab308"
                    : "var(--primary)";
                return (
                  <Link
                    key={quiz.id}
                    href={`/study/${quiz.id}`}
                    className="card card-hover"
                    style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)", position: "relative", overflow: "hidden" }}
                  >
                    {/* Mastery ribbon */}
                    {quizProgress && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          width: `${quizProgress.mastery ?? 0}%`,
                          background: `${masteryColor}10`,
                          borderRight: `2px solid ${masteryColor}`,
                          transition: "width 0.3s ease",
                        }}
                      />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", position: "relative" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${quiz.color ?? "var(--accent)"}15`, display: "grid", placeItems: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                        {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {quiz.title}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {questionCount} Qs · {quiz.category}
                        </div>
                      </div>
                      {quizProgress && (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: "1.1rem", color: masteryColor }}>
                            {quizProgress.mastery ?? 0}%
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>mastery</div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", position: "relative" }}>
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                        Resume
                      </button>
                      <Link href={`/study/${quiz.id}`} className="btn btn-secondary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        Study Again
                      </Link>
                      <ShareButton quizId={quiz.id} quizTitle={quiz.title} />
                    </div>
                    {quizProgress?.last_studied && (
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.5rem", textAlign: "right", position: "relative" }}>
                        Last studied {new Date(quizProgress.last_studied).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* ── Ready to Study ── */}
        <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>Ready to Study</h2>
        {availableQuizzes.length === 0 ? (
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center", border: "2px dashed var(--line-strong)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
              {studiedQuizzes.length === 0 ? "📝" : "🎉"}
            </div>
            {studiedQuizzes.length === 0 ? (
              <>
                <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  No study sets available
                </h3>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                  Create a quiz or explore public quizzes to get started.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
                  <Link href="/explore" className="btn btn-secondary">Browse Public Quizzes</Link>
                  <Link href="/create" className="btn btn-primary">Create Quiz</Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
                  All caught up!
                </h3>
                <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                  You've studied everything available. Create a quiz to add more.
                </p>
                <Link href="/create" className="btn btn-primary" style={{ marginTop: "1.25rem", display: "inline-flex" }}>
                  Create Quiz
                </Link>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
            {availableQuizzes.map((quiz) => {
              const questionCount = quiz.questions?.[0]?.count ?? 0;
              return (
                <Link
                  key={quiz.id}
                  href={`/study/${quiz.id}`}
                  className="card card-hover"
                  style={{ padding: "1.5rem", display: "block", textDecoration: "none", border: "2px solid var(--line)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${quiz.color ?? "var(--accent)"}15`, display: "grid", placeItems: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                      {quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>{quiz.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{questionCount} questions · {quiz.category}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.875rem", padding: "0.5rem" }}>
                      Study Now
                    </button>
                    <ShareButton quizId={quiz.id} quizTitle={quiz.title} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
