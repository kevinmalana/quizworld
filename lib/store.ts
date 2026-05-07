// QuizWorld Data Store — localStorage-backed, ready to swap for Supabase
// All interfaces match the backend schema in BACKEND_ARCHITECTURE.md

export interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  timeLimit: number; // seconds: 10 | 20 | 30 | 60
  points: number; // 500 | 1000 | 2000
}

export interface Quiz {
  id: string;
  title: string;
  category: string;
  emoji: string;
  color: string;
  questions: Question[];
  plays: number;
  creator: string;
  createdAt: number;
  isPublic: boolean;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  answers: PlayerAnswer[];
  isBot?: boolean;
}

export interface PlayerAnswer {
  questionIndex: number;
  answerId: string | null; // null = timed out
  correct: boolean;
  points: number;
  timeMs: number;
}

export interface GameSession {
  pin: string;
  quizId: string;
  quiz: Quiz;
  status: "lobby" | "question" | "reveal" | "leaderboard" | "done";
  currentQuestionIndex: number;
  questionStartTime: number | null;
  players: Player[];
  hostId: string;
  createdAt: number;
}

export interface Profile {
  nickname: string;
  avatar: string;
  totalPlays: number;
  totalCorrect: number;
  totalQuizzes: number;
  streak: number;
  lastStudyDate: string;
  achievements: string[];
  bestScore: number;
}

export interface StudyProgress {
  quizId: string;
  questionsStudied: number;
  correct: number;
  lastStudied: number;
  mastery: number; // 0-100
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const QUIZZES_KEY = "qw_quizzes_v1";
const SESSION_PREFIX = "qw_session_";
const PROFILE_KEY = "qw_profile_v1";
const STUDY_KEY = "qw_study_v1";

// ─── Seed data ───────────────────────────────────────────────────────────────

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: "default-geo",
    title: "World Geography Basics",
    category: "Geography",
    emoji: "🌍",
    color: "#22c55e",
    plays: 1024,
    creator: "QuizWorld",
    createdAt: Date.now() - 3_600_000 * 48,
    isPublic: true,
    questions: [
      {
        id: "g1",
        text: "What is the capital of France?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Paris", isCorrect: true },
          { id: "b", text: "London", isCorrect: false },
          { id: "c", text: "Berlin", isCorrect: false },
          { id: "d", text: "Rome", isCorrect: false },
        ],
      },
      {
        id: "g2",
        text: "Which country has the most natural lakes?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Canada", isCorrect: true },
          { id: "b", text: "Russia", isCorrect: false },
          { id: "c", text: "Brazil", isCorrect: false },
          { id: "d", text: "USA", isCorrect: false },
        ],
      },
      {
        id: "g3",
        text: "What is the longest river in Africa?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Nile", isCorrect: true },
          { id: "b", text: "Congo", isCorrect: false },
          { id: "c", text: "Amazon", isCorrect: false },
          { id: "d", text: "Niger", isCorrect: false },
        ],
      },
      {
        id: "g4",
        text: "Which ocean is the largest?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "Pacific Ocean", isCorrect: true },
          { id: "b", text: "Atlantic Ocean", isCorrect: false },
          { id: "c", text: "Indian Ocean", isCorrect: false },
          { id: "d", text: "Arctic Ocean", isCorrect: false },
        ],
      },
      {
        id: "g5",
        text: "How many continents are there on Earth?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "7", isCorrect: true },
          { id: "b", text: "5", isCorrect: false },
          { id: "c", text: "6", isCorrect: false },
          { id: "d", text: "8", isCorrect: false },
        ],
      },
    ],
  },
  {
    id: "default-sci",
    title: "Science & Nature Fun",
    category: "Science & Nature",
    emoji: "🔬",
    color: "#3b82f6",
    plays: 843,
    creator: "QuizWorld",
    createdAt: Date.now() - 3_600_000 * 72,
    isPublic: true,
    questions: [
      {
        id: "s1",
        text: "What is the chemical symbol for water?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "H₂O", isCorrect: true },
          { id: "b", text: "CO₂", isCorrect: false },
          { id: "c", text: "O₂", isCorrect: false },
          { id: "d", text: "NaCl", isCorrect: false },
        ],
      },
      {
        id: "s2",
        text: "How many bones are in the adult human body?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "206", isCorrect: true },
          { id: "b", text: "200", isCorrect: false },
          { id: "c", text: "212", isCorrect: false },
          { id: "d", text: "196", isCorrect: false },
        ],
      },
      {
        id: "s3",
        text: "What planet is known as the Red Planet?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "Mars", isCorrect: true },
          { id: "b", text: "Jupiter", isCorrect: false },
          { id: "c", text: "Venus", isCorrect: false },
          { id: "d", text: "Saturn", isCorrect: false },
        ],
      },
      {
        id: "s4",
        text: "What is the powerhouse of the cell?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "Mitochondria", isCorrect: true },
          { id: "b", text: "Nucleus", isCorrect: false },
          { id: "c", text: "Ribosome", isCorrect: false },
          { id: "d", text: "Golgi body", isCorrect: false },
        ],
      },
      {
        id: "s5",
        text: "What is the speed of light (approx) in km/s?",
        timeLimit: 30,
        points: 2000,
        answers: [
          { id: "a", text: "300,000 km/s", isCorrect: true },
          { id: "b", text: "150,000 km/s", isCorrect: false },
          { id: "c", text: "450,000 km/s", isCorrect: false },
          { id: "d", text: "1,000,000 km/s", isCorrect: false },
        ],
      },
    ],
  },
  {
    id: "default-ent",
    title: "Pop Culture Trivia",
    category: "Entertainment",
    emoji: "🎬",
    color: "#f97316",
    plays: 2341,
    creator: "QuizWorld",
    createdAt: Date.now() - 3_600_000 * 12,
    isPublic: true,
    questions: [
      {
        id: "e1",
        text: "Which movie features the song 'Let It Go'?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Frozen", isCorrect: true },
          { id: "b", text: "Tangled", isCorrect: false },
          { id: "c", text: "Moana", isCorrect: false },
          { id: "d", text: "Brave", isCorrect: false },
        ],
      },
      {
        id: "e2",
        text: "Which streaming service has the most global subscribers?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Netflix", isCorrect: true },
          { id: "b", text: "Disney+", isCorrect: false },
          { id: "c", text: "Prime Video", isCorrect: false },
          { id: "d", text: "Hulu", isCorrect: false },
        ],
      },
      {
        id: "e3",
        text: "What does 'AI' stand for in technology?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "Artificial Intelligence", isCorrect: true },
          { id: "b", text: "Automated Interface", isCorrect: false },
          { id: "c", text: "Advanced Integration", isCorrect: false },
          { id: "d", text: "Analog Input", isCorrect: false },
        ],
      },
    ],
  },
  {
    id: "default-hist",
    title: "History Highlights",
    category: "History",
    emoji: "📜",
    color: "#eab308",
    plays: 576,
    creator: "QuizWorld",
    createdAt: Date.now() - 3_600_000 * 96,
    isPublic: true,
    questions: [
      {
        id: "h1",
        text: "In what year did World War II end?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "1945", isCorrect: true },
          { id: "b", text: "1944", isCorrect: false },
          { id: "c", text: "1946", isCorrect: false },
          { id: "d", text: "1943", isCorrect: false },
        ],
      },
      {
        id: "h2",
        text: "Who was the first person to walk on the Moon?",
        timeLimit: 20,
        points: 1000,
        answers: [
          { id: "a", text: "Neil Armstrong", isCorrect: true },
          { id: "b", text: "Buzz Aldrin", isCorrect: false },
          { id: "c", text: "Yuri Gagarin", isCorrect: false },
          { id: "d", text: "John Glenn", isCorrect: false },
        ],
      },
      {
        id: "h3",
        text: "The ancient city of Rome is in which modern country?",
        timeLimit: 10,
        points: 500,
        answers: [
          { id: "a", text: "Italy", isCorrect: true },
          { id: "b", text: "Greece", isCorrect: false },
          { id: "c", text: "Spain", isCorrect: false },
          { id: "d", text: "Turkey", isCorrect: false },
        ],
      },
    ],
  },
];

// ─── Quiz CRUD ────────────────────────────────────────────────────────────────

export function getAllQuizzes(): Quiz[] {
  if (typeof window === "undefined") return DEFAULT_QUIZZES;
  try {
    const stored = localStorage.getItem(QUIZZES_KEY);
    const user: Quiz[] = stored ? JSON.parse(stored) : [];
    return [...DEFAULT_QUIZZES, ...user];
  } catch {
    return DEFAULT_QUIZZES;
  }
}

export function getUserQuizzes(): Quiz[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(QUIZZES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getQuizById(id: string): Quiz | null {
  return getAllQuizzes().find((q) => q.id === id) ?? null;
}

export function saveQuiz(quiz: Quiz): void {
  if (typeof window === "undefined") return;
  const user = getUserQuizzes().filter((q) => q.id !== quiz.id);
  user.push(quiz);
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(user));
}

export function deleteQuiz(id: string): void {
  if (typeof window === "undefined") return;
  const user = getUserQuizzes().filter((q) => q.id !== id);
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(user));
}

// ─── Game sessions ────────────────────────────────────────────────────────────

export function generatePin(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const BOT_NAMES = ["QuizBot", "TriviaRex", "BrainStorm", "SmartCookie", "NerdAlert", "AcePlayer"];
const BOT_AVATARS = ["🤖", "👾", "🦾", "🧠", "⚡", "🎯"];

function makeBots(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bot_${i}`,
    nickname: BOT_NAMES[i % BOT_NAMES.length],
    avatar: BOT_AVATARS[i % BOT_AVATARS.length],
    score: 0,
    answers: [],
    isBot: true,
  }));
}

export function createSession(quiz: Quiz, hostNickname: string, botCount = 3): GameSession {
  const pin = generatePin();
  const bots = makeBots(botCount);
  const session: GameSession = {
    pin,
    quizId: quiz.id,
    quiz,
    status: "lobby",
    currentQuestionIndex: -1,
    questionStartTime: null,
    players: [
      { id: "host", nickname: hostNickname, avatar: "🎮", score: 0, answers: [] },
      ...bots,
    ],
    hostId: "host",
    createdAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_PREFIX + pin, JSON.stringify(session));
    sessionStorage.setItem("qw_active_pin", pin);
    sessionStorage.setItem("qw_player_id", "host");
  }
  return session;
}

export function getSession(pin: string): GameSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + pin.toUpperCase());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function updateSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_PREFIX + session.pin, JSON.stringify(session));
}

export function joinSession(
  pin: string,
  nickname: string
): { session: GameSession; playerId: string } | null {
  const session = getSession(pin);
  if (!session) return null;
  if (session.status !== "lobby") return null;
  const playerId = `player_${Date.now()}`;
  const playerAvatars = ["🦁", "🐯", "🐺", "🦊", "🐸", "🦄", "🐉", "🦋"];
  const player: Player = {
    id: playerId,
    nickname,
    avatar: playerAvatars[Math.floor(Math.random() * playerAvatars.length)],
    score: 0,
    answers: [],
  };
  session.players.push(player);
  updateSession(session);
  if (typeof window !== "undefined") {
    sessionStorage.setItem("qw_active_pin", pin.toUpperCase());
    sessionStorage.setItem("qw_player_id", playerId);
  }
  return { session, playerId };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function defaultProfile(): Profile {
  return {
    nickname: "QuizPlayer",
    avatar: "🎮",
    totalPlays: 0,
    totalCorrect: 0,
    totalQuizzes: 0,
    streak: 0,
    lastStudyDate: "",
    achievements: [],
    bestScore: 0,
  };
}

export function getProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(updates: Partial<Profile>): void {
  if (typeof window === "undefined") return;
  const current = getProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...current, ...updates }));
}

export function recordGameResult(correct: number, total: number, score: number): void {
  const p = getProfile();
  saveProfile({
    totalPlays: p.totalPlays + 1,
    totalCorrect: p.totalCorrect + correct,
    bestScore: Math.max(p.bestScore, score),
  });
}

// ─── Study progress ───────────────────────────────────────────────────────────

export function getStudyProgress(): StudyProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STUDY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStudyProgress(progress: StudyProgress): void {
  if (typeof window === "undefined") return;
  const all = getStudyProgress().filter((p) => p.quizId !== progress.quizId);
  all.push(progress);
  localStorage.setItem(STUDY_KEY, JSON.stringify(all));
  // Update streak
  const today = new Date().toDateString();
  const p = getProfile();
  if (p.lastStudyDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = p.lastStudyDate === yesterday ? p.streak + 1 : 1;
    saveProfile({ streak: newStreak, lastStudyDate: today });
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const CATEGORY_COLORS: Record<string, string> = {
  "General Knowledge": "#8b5cf6", Trivia: "#8b5cf6", Education: "#6366f1",
  "Science & Nature": "#3b82f6", "Space & Astronomy": "#1e40af", Technology: "#0ea5e9", Math: "#06b6d4", Programming: "#0891b2",
  History: "#eab308", Geography: "#22c55e", "Politics & Government": "#a16207", "Current Events": "#ca8a04",
  Entertainment: "#f97316", Movies: "#ea580c", "TV Shows": "#dc2626", Music: "#e11d48", "Pop Culture": "#f43f5e", Celebrities: "#fb923c", "Comics & Anime": "#d946ef",
  Sports: "#ef4444", "Video Games": "#7c3aed", "Travel & Tourism": "#14b8a6",
  "Art & Literature": "#e879f9", Photography: "#a855f7", "Fashion & Style": "#ec4899",
  "Food & Drink": "#f97316", "Health & Medicine": "#22c55e", "Animals & Pets": "#84cc16", "Nature & Environment": "#16a34a",
  "Psychology & Mind": "#8b5cf6", "Mythology & Folklore": "#7c3aed", "Religion & Spirituality": "#a78bfa",
  Languages: "#06b6d4", Business: "#64748b", "Social Media & Internet": "#0ea5e9", "DIY & Crafts": "#d97706",
  "Cars & Automotive": "#475569", "Relationships & Dating": "#e11d48", "Holidays & Celebrations": "#dc2626",
  "Inventions & Discoveries": "#0d9488",
  Other: "#6b7280",
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  "General Knowledge": "🧠", Trivia: "💡", Education: "📚",
  "Science & Nature": "🔬", "Space & Astronomy": "🚀", Technology: "💻", Math: "🔢", Programming: "🧑‍💻",
  History: "📜", Geography: "🌍", "Politics & Government": "🏛️", "Current Events": "📰",
  Entertainment: "🎬", Movies: "🎥", "TV Shows": "📺", Music: "🎵", "Pop Culture": "🌟", Celebrities: "⭐", "Comics & Anime": "🦸",
  Sports: "⚽", "Video Games": "🎮", "Travel & Tourism": "✈️",
  "Art & Literature": "🎨", Photography: "📷", "Fashion & Style": "👗",
  "Food & Drink": "🍕", "Health & Medicine": "🏥", "Animals & Pets": "🐾", "Nature & Environment": "🌿",
  "Psychology & Mind": "🧬", "Mythology & Folklore": "🐉", "Religion & Spirituality": "🕊️",
  Languages: "💬", Business: "💼", "Social Media & Internet": "📱", "DIY & Crafts": "🔨",
  "Cars & Automotive": "🚗", "Relationships & Dating": "❤️", "Holidays & Celebrations": "🎄",
  "Inventions & Discoveries": "💡",
  Other: "📌",
};
