import { extractYouTubeId } from "@/lib/media/youtube";
import type { GameQuestion } from "@/lib/game/session-normalizers";

export function QuestionMedia({
  question,
  maxHeight = 240,
  margin = "1rem",
}: {
  question: GameQuestion;
  maxHeight?: number;
  margin?: string;
}) {
  const q = question as GameQuestion & { image_url?: string; video_url?: string };
  const youtubeId = q.video_url ? extractYouTubeId(q.video_url) : null;

  return (
    <>
      {q.image_url && (
        <img
          src={q.image_url}
          alt=""
          className="game-question-img"
          style={{ maxHeight, marginTop: margin, marginBottom: margin === "0" ? 0 : undefined }}
        />
      )}
      {q.video_url && youtubeId && (
        <div
          className="game-video-wrapper"
          style={{ marginTop: margin, marginBottom: margin === "0" ? 0 : undefined }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="game-video-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </>
  );
}
