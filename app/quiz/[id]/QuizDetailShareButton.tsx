"use client";

import { useState } from "react";

export function QuizDetailShareButton({
  quizUrl,
  quizTitle,
}: {
  quizUrl: string;
  quizTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const text = `Check out "${quizTitle}" on QuizWorld! ${quizUrl}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <button
      onClick={handleShare}
      className="btn btn-secondary btn-compact"
      title="Share quiz"
      style={{ flexShrink: 0, alignSelf: "flex-start" }}
    >
      {copied ? "✅ Copied!" : "📤 Share"}
    </button>
  );
}
