import type { SlideType, SlideContent } from "@/lib/presentation/types";

export const SLIDE_TYPES: { type: SlideType; icon: string; label: string; desc: string }[] = [
  { type: "content", icon: "📝", label: "Content", desc: "Text, images, video" },
  { type: "word_cloud", icon: "☁️", label: "Word Cloud", desc: "Collect words, visualize" },
  { type: "open_text", icon: "💬", label: "Open Text", desc: "Written responses" },
  { type: "poll", icon: "📊", label: "Poll", desc: "Vote on options" },
  { type: "quiz", icon: "🏆", label: "Quiz", desc: "Competitive question" },
  { type: "scale", icon: "📏", label: "Scale", desc: "Rate 1-10" },
  { type: "qna", icon: "❓", label: "Q&A", desc: "Audience questions" },
];

export function defaultContent(type: SlideType): SlideContent {
  switch (type) {
    case "content": return { text: "" };
    case "word_cloud": return { prompt: "What comes to mind when you think of…?" };
    case "open_text": return { question: "What do you think?" };
    case "poll": return { options: [{ id: "1", text: "Option A" }, { id: "2", text: "Option B" }] };
    case "quiz": return { answers: [{ id: "1", text: "Answer A", is_correct: true }, { id: "2", text: "Answer B", is_correct: false }], time_limit: 20, points: 1000 };
    case "scale": return { min: 1, max: 10, min_label: "Not at all", max_label: "Very much" };
    case "qna": return { moderated: false };
  }
}
