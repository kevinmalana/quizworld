// Shared types and constants used across the app.

export function uid(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  timeLimit: number;
  points: number;
}

export interface Quiz {
  id: string;
  slug?: string | null;
  title: string;
  category: string;
  emoji: string;
  color: string;
  plays: number;
  creator: string;
  createdAt: number;
  isPublic: boolean;
  questions?: Question[];
  // Supabase join fields
  creator_username?: string | null;
  creator_avatar?: string | null;
  creator_level?: number | null;
  creator_level_title?: string | null;
  thumbnail_url?: string | null;
  question_count?: number | null;
}

export interface PlayerAnswer {
  questionIndex: number;
  answerId: string | null;
  correct: boolean;
  points: number;
  timeMs: number;
}

// ─── Categories ────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  "General Knowledge": "#8b5cf6", Trivia: "#8b5cf6", Education: "#6366f1",
  "Science & Nature": "#3b82f6", "Space & Astronomy": "#1e40af",
  Technology: "#0ea5e9", Math: "#06b6d4", Mathematics: "#06b6d4", Programming: "#0891b2", Computers: "#0ea5e9",
  History: "#eab308", Geography: "#22c55e", Politics: "#a16207", "Politics & Government": "#a16207", "Current Events": "#ca8a04",
  Entertainment: "#f97316", Movies: "#ea580c", "TV Shows": "#dc2626", Television: "#dc2626",
  Music: "#e11d48", "Pop Culture": "#f43f5e", Celebrities: "#fb923c",
  "Comics & Anime": "#d946ef", Comics: "#d946ef", "Anime & Manga": "#be185d", Cartoons: "#ca8a04",
  Sports: "#ef4444", "Video Games": "#7c3aed", "Travel & Tourism": "#14b8a6",
  "Art & Literature": "#e879f9", Art: "#d946ef", Photography: "#a855f7", "Fashion & Style": "#ec4899",
  "Food & Drink": "#f97316", "Health & Medicine": "#22c55e",
  Animals: "#84cc16", "Animals & Pets": "#84cc16", "Nature & Environment": "#16a34a",
  "Psychology & Mind": "#8b5cf6", Mythology: "#7c3aed", "Mythology & Folklore": "#7c3aed", "Religion & Spirituality": "#a78bfa",
  Languages: "#06b6d4", Business: "#64748b", "Social Media & Internet": "#0ea5e9", "DIY & Crafts": "#d97706",
  Vehicles: "#475569", "Cars & Automotive": "#475569", "Relationships & Dating": "#e11d48", "Holidays & Celebrations": "#dc2626",
  "Inventions & Discoveries": "#0d9488", Books: "#8b5cf6", "Board Games": "#78716c",
  "Musicals & Theatre": "#10b981", "Gadgets & Tech": "#0369a1",
  Other: "#6b7280",
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  "General Knowledge": "🧠", Trivia: "💡", Education: "📚",
  "Science & Nature": "🔬", "Space & Astronomy": "🚀", Technology: "💻", Math: "🔢", Mathematics: "🔢", Programming: "🧑💻", Computers: "💻",
  History: "📜", Geography: "🌍", Politics: "🏛️", "Politics & Government": "🏛️", "Current Events": "📰",
  Entertainment: "🎬", Movies: "🎥", "TV Shows": "📺", Television: "📺",
  Music: "🎵", "Pop Culture": "🌟", Celebrities: "⭐",
  "Comics & Anime": "🦸", Comics: "💥", "Anime & Manga": "🌸", Cartoons: "🐱",
  Sports: "⚽", "Video Games": "🎮", "Travel & Tourism": "✈️",
  "Art & Literature": "🎨", Art: "🎨", Photography: "📷", "Fashion & Style": "👗",
  "Food & Drink": "🍕", "Health & Medicine": "🏥",
  Animals: "🐾", "Animals & Pets": "🐾", "Nature & Environment": "🌿",
  "Psychology & Mind": "🧬", Mythology: "⚡", "Mythology & Folklore": "🐉", "Religion & Spirituality": "🕊️",
  Languages: "💬", Business: "💼", "Social Media & Internet": "📱", "DIY & Crafts": "🔨",
  Vehicles: "🚗", "Cars & Automotive": "🚗", "Relationships & Dating": "❤️", "Holidays & Celebrations": "🎄",
  "Inventions & Discoveries": "💡", Books: "📚", "Board Games": "♟️",
  "Musicals & Theatre": "🎭", "Gadgets & Tech": "📱",
  Other: "📌",
};