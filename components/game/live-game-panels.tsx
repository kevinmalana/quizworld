import Link from "next/link";
import { QrCode } from "@/components/shared/qr-code";
import { extractYouTubeId } from "@/lib/media/youtube";
import type { CurrentAnswer, GameAnswer, GamePlayer, GameQuestion } from "@/lib/game/session-normalizers";

export function GameNotice({ notice, maxWidth = 720 }: { notice: string | null; maxWidth?: number }) {
  if (!notice) return null;
  return (
    <div className="card" style={{ padding: "0.9rem 1rem", maxWidth, margin: "0 auto 1rem", color: "var(--primary)", background: "var(--primary-light)" }}>
      {notice}
    </div>
  );
}

export function GameProgressBar({ currentIndex, totalQuestions, compact = false }: { currentIndex: number; totalQuestions: number; compact?: boolean }) {
  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 1rem" }}>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.35rem" }}>
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
      )}
      <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", borderRadius: 4, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export function QuestionMedia({ question, maxHeight = 240, margin = "1rem" }: { question: GameQuestion; maxHeight?: number; margin?: string }) {
  const questionWithMedia = question as GameQuestion & { image_url?: string; video_url?: string };
  const youtubeId = questionWithMedia.video_url ? extractYouTubeId(questionWithMedia.video_url) : null;

  return (
    <>
      {questionWithMedia.image_url && (
        <img src={questionWithMedia.image_url} alt="" style={{ width: "100%", maxHeight, objectFit: "cover", borderRadius: 16, marginTop: margin, marginBottom: margin === "0" ? 0 : undefined }} />
      )}
      {questionWithMedia.video_url && youtubeId && (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginTop: margin, marginBottom: margin === "0" ? 0 : undefined, borderRadius: 16, overflow: "hidden" }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </>
  );
}

export function WaitingLobbyPanel({
  pin,
  joinUrl,
  notice,
  players,
  readyPlayers,
  readyCount,
  isHost,
  currentPlayer,
  playerSessionReady,
  amReady,
  onReady,
  onStart,
}: {
  pin: string;
  joinUrl: string;
  notice: string | null;
  players: GamePlayer[];
  readyPlayers: Set<string>;
  readyCount: number;
  isHost: boolean;
  currentPlayer: GamePlayer | null;
  playerSessionReady: boolean;
  amReady: boolean;
  onReady: () => void;
  onStart: () => void;
}) {
  return (
    <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
      <GameNotice notice={notice} maxWidth={640} />
      <div className="card" style={{ padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎮</div>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Waiting for host...</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", marginBottom: "2rem", flexWrap: "wrap", flexDirection: "row" }} className="lobby-pin-qr">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.5rem" }}>Game PIN</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, letterSpacing: "0.2em", color: "var(--accent)", fontFamily: "var(--font-display)" }}>{pin}</div>
          </div>
          <div style={{ width: 1, height: 60, background: "var(--line)" }} />
          <div style={{ textAlign: "center" }}>
            <QrCode value={joinUrl} size={120} label="Scan to join" className="qr-code qr-code-sm" />
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--muted)", marginTop: "0.35rem" }}>Scan to join</div>
          </div>
        </div>

        {players.length > 0 && (
          <>
            {isHost && readyCount > 0 && <p style={{ fontSize: "0.875rem", color: "var(--success)", fontWeight: 700, marginBottom: "0.75rem" }}>✅ {readyCount}/{players.length} players ready</p>}
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.5rem", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              {players.map((player) => (
                <div key={player.id} style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-lg)", background: readyPlayers.has(player.id) ? "var(--accent-light)" : "var(--bg)", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, border: readyPlayers.has(player.id) ? "2px solid var(--accent)" : "2px solid transparent" }}>
                  <span>{player.avatar || "🎮"}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{player.nickname}</span>
                  {readyPlayers.has(player.id) && <span style={{ color: "var(--success)" }}>✅ Ready</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {!isHost && currentPlayer && !amReady && <button onClick={onReady} className="btn btn-primary" style={{ width: "100%", marginBottom: "0.75rem" }}>Ready ✅</button>}
        {!isHost && currentPlayer && amReady && <div style={{ padding: "0.75rem", background: "var(--accent-light)", borderRadius: "var(--radius-lg)", marginBottom: "0.75rem", fontWeight: 700, color: "var(--success)" }}>✅ You're ready!</div>}
        {isHost && <button onClick={onStart} disabled={players.length === 0} className="btn btn-primary btn-lg" style={{ width: "100%" }}>{players.length === 0 ? "Waiting for players..." : "Start Game 🚀"}</button>}
        {!isHost && !currentPlayer && playerSessionReady && <Link href={`/join?pin=${pin}`} className="btn btn-secondary">Join this game</Link>}
      </div>
    </div>
  );
}

export function ActiveHostDashboard({ currentAnswers, players, currentQuestion, timeLeft }: { currentAnswers: CurrentAnswer[]; players: GamePlayer[]; currentQuestion: GameQuestion; timeLeft: number }) {
  return (
    <div className="card" style={{ padding: "1.25rem", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <HostMetric value={`${currentAnswers.length}/${players.length}`} label="Answered" color="var(--accent)" />
        <HostMetric
          value={`${currentAnswers.length > 0 ? Math.round(currentAnswers.filter((a) => a.is_correct).length / currentAnswers.length * 100) : 0}%`}
          label="Accuracy"
          color={currentAnswers.length > 0 && currentAnswers.filter((a) => a.is_correct).length / currentAnswers.length >= 0.7 ? "var(--success)" : "var(--primary)"}
        />
        <HostMetric value={`${timeLeft}s`} label="Time Left" color={timeLeft <= 5 ? "var(--primary)" : "var(--ink)"} />
      </div>
      {currentAnswers.length > 0 && currentQuestion.answers && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${currentQuestion.answers.length}, 1fr)`, gap: "0.375rem" }}>
          {currentQuestion.answers.map((answer, i) => {
            const count = currentAnswers.filter((row) => row.answer_id === answer.id).length;
            const pct = Math.round(count / currentAnswers.length * 100);
            return (
              <div key={answer.id} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: answer.is_correct ? "var(--accent)" : "var(--muted)" }}>{String.fromCharCode(65 + i)}</div>
                <div style={{ height: 40, borderRadius: 4, background: "var(--line)", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${pct}%`, borderRadius: 4, background: answer.is_correct ? "var(--accent)" : "var(--muted)", transition: "height 0.3s" }} />
                </div>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--muted)" }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HostMetric({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

export function SpectatorPanel() {
  return (
    <div className="card" style={{ padding: "1.5rem", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
      <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Spectator view</p>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>The game is already in progress.<br />Watch along or join the next session.</p>
      <Link href="/" className="btn btn-secondary">Back to Home</Link>
    </div>
  );
}

export function PlayerAnswerGrid({ currentQuestion, selectedAnswer, submittingAnswer, timeLeft, onSubmit }: { currentQuestion: GameQuestion; selectedAnswer: string | null; submittingAnswer: boolean; timeLeft: number; onSubmit: (answer: { id: string }) => void }) {
  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 680, margin: "0 auto" }}>
      {currentQuestion.answers?.map((answer, index) => (
        <button key={answer.id} onClick={() => onSubmit(answer)} disabled={selectedAnswer !== null || submittingAnswer || timeLeft <= 0} style={{ padding: "1.5rem", borderRadius: "var(--radius-xl)", border: "3px solid var(--line)", background: selectedAnswer === answer.id ? "var(--accent)" : "var(--surface)", color: selectedAnswer === answer.id ? "#fff" : "var(--ink)", fontSize: "1.125rem", fontWeight: 700, cursor: selectedAnswer !== null ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: selectedAnswer === answer.id ? "#fff" : "var(--bg)", color: selectedAnswer === answer.id ? "var(--accent)" : "var(--muted)", display: "grid", placeItems: "center", fontWeight: 900, flexShrink: 0 }}>{String.fromCharCode(65 + index)}</span>
          {(answer as GameAnswer & { image_url?: string }).image_url && <img src={(answer as any).image_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />}
          {answer.text}
        </button>
      ))}
    </div>
  );
}

export function AnswerRevealList({ answerCounts }: { answerCounts: (GameAnswer & { count: number; image_url?: string | null })[] }) {
  return (
    <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
      {answerCounts.map((answer, index) => (
        <div key={answer.id} style={{ padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)", border: answer.is_correct ? "2px solid var(--accent)" : "1px solid var(--line)", background: answer.is_correct ? "var(--accent-light)" : "var(--surface)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {answer.is_correct ? "✅" : `${String.fromCharCode(65 + index)}.`} {answer.text}
            {answer.image_url && <img src={answer.image_url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />}
          </span>
          <span style={{ color: "var(--muted)", fontWeight: 700 }}>{answer.count} vote{answer.count !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function LeaderboardList({ leaderboard, playerStreaks, playerAchievements, playerCorrectCounts, totalQuestions }: { leaderboard: GamePlayer[]; playerStreaks: Record<string, number>; playerAchievements: Record<string, { label: string; emoji: string }[]>; playerCorrectCounts: Record<string, number>; totalQuestions: number }) {
  return (
    <div>
      <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>Leaderboard</h3>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {leaderboard.map((player, index) => (
          <div key={player.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1rem", borderRadius: "var(--radius-lg)", background: "var(--bg)" }}>
            <span style={{ fontWeight: 700 }}>
              {index + 1}. {player.avatar || "🎮"} {player.nickname}
              {(playerStreaks[player.id] ?? 0) >= 2 && <span style={{ marginLeft: "0.5rem" }}>🔥{playerStreaks[player.id]}</span>}
              {(playerAchievements[player.id] ?? []).map((badge, bi) => <span key={bi} style={{ marginLeft: "0.375rem", fontSize: "0.75rem" }} title={badge.label}>{badge.emoji}</span>)}
            </span>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>{playerCorrectCounts[player.id] ?? 0}/{totalQuestions} ✓ · {(player.score ?? 0).toLocaleString()} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export function GameFinishedPanel({
  notice,
  pin,
  leaderboard,
  isHost,
  session,
  playerAchievements,
  playerCorrectCounts,
  totalQuestions,
  aiSummary,
  aiSummaryLoading,
  onGenerateAiSummary,
}: {
  notice: string | null;
  pin: string;
  leaderboard: GamePlayer[];
  isHost: boolean;
  session: Record<string, unknown> | null;
  playerAchievements: Record<string, { label: string; emoji: string }[]>;
  playerCorrectCounts: Record<string, number>;
  totalQuestions: number;
  aiSummary: string | null;
  aiSummaryLoading: boolean;
  onGenerateAiSummary: () => void;
}) {
  return (
    <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", textAlign: "center" }}>
      <GameNotice notice={notice} maxWidth={640} />
      <div className="card" style={{ padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏆</div>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>Game Finished</h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>Final leaderboard for PIN {pin}</p>

        {leaderboard.length >= 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "1rem", marginBottom: "2rem" }}>
            {leaderboard.slice(0, 3).map((_player, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const heights = [140, 110, 90];
              const order = [1, 0, 2];
              const idx = order[i] ?? i;
              const p = leaderboard[idx];
              if (!p) return null;
              return (
                <div key={p.id} style={{ textAlign: "center", animation: i === 1 ? "pulse 1.5s infinite" : "none" }}>
                  <div style={{ fontSize: "2rem" }}>{medals[idx]}</div>
                  <div style={{ fontSize: "1.5rem" }}>{p.avatar || "🎮"}</div>
                  <div style={{ fontWeight: 800, fontSize: "0.875rem" }}>{p.nickname}</div>
                  <div style={{ height: heights[idx], width: 80, background: i === 1 ? "var(--accent)" : "var(--line)", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0.5rem", marginTop: "0.5rem" }}>
                    <span style={{ fontWeight: 900, color: i === 1 ? "#fff" : "var(--ink)", fontSize: "0.875rem" }}>{(p.score ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
          {leaderboard.map((player, index) => (
            <div key={player.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)", background: index === 0 ? "var(--accent-light)" : "var(--bg)", border: index === 0 ? "2px solid var(--accent)" : "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700 }}>
                {index < 3 ? ["🥇", "🥈", "🥉"][index] : `${index + 1}.`} {player.avatar || "🎮"} {player.nickname}
                {(playerAchievements[player.id] ?? []).map((badge, bi) => <span key={bi} style={{ marginLeft: "0.375rem", fontSize: "0.875rem" }} title={badge.label}>{badge.emoji}</span>)}
              </span>
              <span style={{ fontWeight: 700 }}>{playerCorrectCounts[player.id] ?? 0}/{totalQuestions} ✓ · {(player.score ?? 0).toLocaleString()} pts</span>
            </div>
          ))}
        </div>

        {isHost && (
          <div style={{ marginBottom: "1.5rem", textAlign: "left" }}>
            {!aiSummary && !aiSummaryLoading && <button onClick={onGenerateAiSummary} className="btn btn-secondary" style={{ width: "100%", padding: "0.75rem" }}>🧠 Get AI Insights</button>}
            {aiSummaryLoading && <div style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg)", textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>🧠 Analyzing game data...</div>}
            {aiSummary && (
              <div style={{ padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)", background: "var(--accent-light)", border: "1px solid var(--accent)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.5rem" }}>🧠 AI Insights</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{aiSummary}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {isHost && (session as { quiz_id?: string })?.quiz_id && <Link href={`/host?quiz=${(session as { quiz_id: string }).quiz_id}`} className="btn btn-primary">Play Again 🔄</Link>}
          {isHost && <Link href={`/report/${pin}`} className="btn btn-secondary">View Report 📊</Link>}
          <Link href="/" className="btn btn-secondary">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
