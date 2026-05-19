import type { CurrentAnswer, GamePlayer, GameQuestion } from "@/lib/game/session-normalizers";
import type { Team } from "./TeamScoreBar";
import { TeamScoreBar } from "./TeamScoreBar";

export function ActiveHostDashboard({
  currentAnswers,
  players,
  currentQuestion,
  timeLeft,
  teams = {},
  teamAssignments = {},
  gameMode = "classic",
}: {
  currentAnswers: CurrentAnswer[];
  players: GamePlayer[];
  currentQuestion: GameQuestion;
  timeLeft: number;
  teams?: Record<string, Team>;
  teamAssignments?: Record<string, string>;
  gameMode?: string;
}) {
  const answered = currentAnswers.length;
  const correct = currentAnswers.filter((a) => a.is_correct).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="card game-host-dashboard">
      <div className="game-host-metrics">
        <HostMetric value={`${answered}/${players.length}`} label="Answered" color="var(--accent)" />
        <HostMetric
          value={`${accuracy}%`}
          label="Accuracy"
          color={answered > 0 && accuracy >= 70 ? "var(--success)" : "var(--primary)"}
        />
        <HostMetric
          value={`${timeLeft}s`}
          label="Time Left"
          color={timeLeft <= 5 ? "var(--primary)" : "var(--ink)"}
        />
      </div>

      {/* Team mode: show live team scores alongside answer bars */}
      {gameMode === "team" && Object.keys(teams).length > 0 && (
        <TeamScoreBar teams={teams} myTeamId={null} />
      )}

      {answered > 0 && currentQuestion.answers && (
        <div
          className="game-host-bars"
          style={{ gridTemplateColumns: `repeat(${currentQuestion.answers.length}, 1fr)` }}
        >
          {currentQuestion.answers.map((answer, i) => {
            const count = currentAnswers.filter((r) => r.answer_id === answer.id).length;
            const pct = Math.round((count / answered) * 100);
            return (
              <div key={answer.id} className="game-host-bar-col">
                <div
                  className="game-host-bar-letter"
                  style={{ color: answer.is_correct ? "var(--accent)" : "var(--muted)" }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="game-host-bar-track">
                  <div
                    className="game-host-bar-fill"
                    style={{
                      height: `${pct}%`,
                      background: answer.is_correct ? "var(--accent)" : "var(--muted)",
                    }}
                  />
                </div>
                <div className="game-host-bar-pct">{pct}%</div>
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
    <div className="game-host-metric">
      <div className="game-host-metric-value" style={{ color }}>{value}</div>
      <div className="game-host-metric-label">{label}</div>
    </div>
  );
}
