import { CATEGORY_EMOJIS } from "@/lib/shared";

type SelectedQuiz = {
  title: string;
  emoji: string | null;
  color: string | null;
  category: string;
  question_count: number;
  plays: number;
};

export function HostSelectedQuiz({
  quiz,
  gameMode,
  onChange,
}: {
  quiz: SelectedQuiz | null;
  gameMode: string;
  onChange: () => void;
}) {
  if (!quiz) {
    return <div className="card host-empty-selection"><span className="host-empty-icon">👆</span><span>Select a quiz below to get started</span></div>;
  }

  return (
    <div className="card host-selected-card">
      <div className="host-selected-inner">
        <div className="host-selected-emoji" style={{ background: `${quiz.color || "#7c3aed"}15` }}>{quiz.emoji || CATEGORY_EMOJIS[quiz.category] || "📝"}</div>
        <div className="host-selected-info">
          <div className="host-selected-label">Selected Quiz</div>
          <div className="host-selected-title">{quiz.title}</div>
          <div className="host-selected-meta"><span>📝 {quiz.question_count} questions</span><span>{quiz.category}</span>{quiz.plays > 0 && <span>▶️ {quiz.plays} plays</span>}</div>
        </div>
        <button className="btn btn-secondary btn-compact" onClick={onChange}>Change</button>
      </div>
      {gameMode !== "classic" && <div className="host-selected-mode-badge">{gameMode === "survival" ? "💀 Survival Mode" : "👥 Team Battle"}</div>}
    </div>
  );
}
