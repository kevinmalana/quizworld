export type SlideType = "content" | "word_cloud" | "open_text" | "poll" | "quiz" | "scale" | "qna";

export interface SlideContent {
  // content
  text?: string;
  image_url?: string;
  video_url?: string;
  _imported?: boolean; // marks slides created via deck import; stripped on save

  // word_cloud
  prompt?: string;

  // open_text
  question?: string;

  // poll
  options?: { id: string; text: string }[];

  // quiz
  answers?: { id: string; text: string; is_correct: boolean }[];
  time_limit?: number;
  points?: number;

  // scale
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;

  // qna
  moderated?: boolean;
}

export interface Slide {
  id: string;
  presentation_id: string;
  slide_type: SlideType;
  title: string;
  content: SlideContent;
  order_index: number;
  settings: Record<string, unknown>;
}

export interface Presentation {
  id: string;
  creator_id: string;
  title: string;
  status: "draft" | "live" | "finished";
  join_code: string | null;
  settings: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
  slides?: Slide[];
}

export interface SlideResponse {
  id: string;
  slide_id: string;
  participant_id: string;
  participant_name: string;
  response_data: Record<string, unknown>;
  created_at: string;
}

export interface QnaQuestion {
  id: string;
  slide_id: string;
  participant_id: string;
  participant_name: string;
  question: string;
  upvotes: number;
  answered: boolean;
  created_at: string;
}

// Helper to generate a unique participant ID
export function getParticipantId(): string {
  if (typeof window === "undefined") return "server";
  const key = "qw_present_participant_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export function getParticipantName(): string {
  if (typeof window === "undefined") return "Anonymous";
  return localStorage.getItem("qw_present_name") || "Anonymous";
}

export function setParticipantName(name: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("qw_present_name", name);
  }
}
