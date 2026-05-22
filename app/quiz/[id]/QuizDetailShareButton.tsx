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
    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback for non-secure contexts (HTTP)
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.top = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    void doCopy();
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
