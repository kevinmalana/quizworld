/**
 * QuizWorld — OpenTDB Mass Importer
 * Fetches all verified questions from OpenTDB (CC BY-SA 4.0)
 * Creates 5 real-name seed users + imports quizzes per category
 *
 * Run: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/opentdb-import.mjs
 * Dry run: DRY_RUN=1 node scripts/opentdb-import.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = "https://tqmygnkwkjtkteguemya.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── SEED PERSONAS (real-looking names) ────────────────────────────────────
const PERSONAS = [
  {
    email: "alex.rivera@quizworld.xyz",
    username: "alex_rivera",
    display_name: "Alex Rivera",
    bio: "Trivia addict since forever. General knowledge is my superpower 🧠",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alexrivera",
    categories: [9, 23, 24, 20], // General Knowledge, History, Politics, Mythology
  },
  {
    email: "jamie.chen@quizworld.xyz",
    username: "jamie_chen",
    display_name: "Jamie Chen",
    bio: "Pop culture obsessed. Movies, music, TV — I live for it 🎬🎵",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jamiechen",
    categories: [11, 12, 14, 13, 26, 29, 31, 32], // Film, Music, TV, Musicals, Celebrities, Comics, Anime, Cartoons
  },
  {
    email: "sam.okafor@quizworld.xyz",
    username: "sam_okafor",
    display_name: "Sam Okafor",
    bio: "Sports nut and geography geek. Ask me anything about the world 🌍⚽",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=samokafor",
    categories: [21, 22, 27, 28], // Sports, Geography, Animals, Vehicles
  },
  {
    email: "taylor.brooks@quizworld.xyz",
    username: "taylor_brooks",
    display_name: "Taylor Brooks",
    bio: "Science nerd, gamer, tech geek. STEM trivia is where I shine 🔬💻",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=taylorbrooks",
    categories: [17, 18, 19, 15, 30], // Science, Computers, Math, Video Games, Gadgets
  },
  {
    email: "morgan.lee@quizworld.xyz",
    username: "morgan_lee",
    display_name: "Morgan Lee",
    bio: "Art lover, bookworm, board game champion. Culture is everything 🎨📚",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=morganlee",
    categories: [10, 16, 25], // Books, Board Games, Art
  },
];

// ─── OPENTDB CATEGORY → QUIZWORLD LABEL ────────────────────────────────────
const CATEGORY_MAP = {
  9:  { label: "General Knowledge", emoji: "🧠", color: "#6366f1" },
  10: { label: "Books",             emoji: "📚", color: "#8b5cf6" },
  11: { label: "Movies",            emoji: "🎬", color: "#ec4899" },
  12: { label: "Music",             emoji: "🎵", color: "#f59e0b" },
  13: { label: "Musicals & Theatre",emoji: "🎭", color: "#10b981" },
  14: { label: "Television",        emoji: "📺", color: "#3b82f6" },
  15: { label: "Video Games",       emoji: "🎮", color: "#ef4444" },
  16: { label: "Board Games",       emoji: "♟️", color: "#78716c" },
  17: { label: "Science & Nature",  emoji: "🔬", color: "#22c55e" },
  18: { label: "Computers",         emoji: "💻", color: "#0ea5e9" },
  19: { label: "Mathematics",       emoji: "➕", color: "#a855f7" },
  20: { label: "Mythology",         emoji: "⚡", color: "#f97316" },
  21: { label: "Sports",            emoji: "⚽", color: "#16a34a" },
  22: { label: "Geography",         emoji: "🌍", color: "#0891b2" },
  23: { label: "History",           emoji: "📜", color: "#92400e" },
  24: { label: "Politics",          emoji: "🏛️", color: "#1d4ed8" },
  25: { label: "Art",               emoji: "🎨", color: "#d946ef" },
  26: { label: "Celebrities",       emoji: "⭐", color: "#eab308" },
  27: { label: "Animals",           emoji: "🐾", color: "#15803d" },
  28: { label: "Vehicles",          emoji: "🚗", color: "#475569" },
  29: { label: "Comics",            emoji: "💥", color: "#dc2626" },
  30: { label: "Gadgets",           emoji: "📱", color: "#0369a1" },
  31: { label: "Anime & Manga",     emoji: "🌸", color: "#be185d" },
  32: { label: "Cartoons",          emoji: "🐱", color: "#ca8a04" },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fetch up to `amount` questions for a category from OpenTDB
// OpenTDB max per request = 50; rate limit: 1 req/5s per session
async function fetchCategory(categoryId, amount = 50) {
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${categoryId}&type=multiple&encode=url3986`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.response_code !== 0) {
    console.warn(`    ⚠️  Category ${categoryId} response_code=${data.response_code}`);
    return [];
  }

  return data.results.map((q) => ({
    text: decodeURIComponent(q.question),
    correct: decodeURIComponent(q.correct_answer),
    incorrect: q.incorrect_answers.map(decodeURIComponent),
    difficulty: q.difficulty,
  }));
}

// Build shuffled answer array, return answers + correct index
function buildAnswers(question) {
  const all = shuffle([question.correct, ...question.incorrect]);
  return {
    answers: all,
    correctIndex: all.indexOf(question.correct),
  };
}

// Group questions into quizzes of QUIZ_SIZE questions each
const QUIZ_SIZE = 10;

function groupIntoQuizzes(questions, categoryId, creatorName) {
  const cat = CATEGORY_MAP[categoryId];
  const quizzes = [];
  const batches = chunk(questions, QUIZ_SIZE);

  batches.forEach((batch, i) => {
    if (batch.length < 5) return; // skip tiny leftovers
    const suffix = batches.length > 1 ? ` #${i + 1}` : "";
    quizzes.push({
      title: `${cat.label} Trivia${suffix}`,
      category: cat.label,
      emoji: cat.emoji,
      color: cat.color,
      questions: batch,
      plays: Math.floor(Math.random() * 40) + 2,
      // Spread created_at over last 90 days
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  return quizzes;
}

// ─── UPSERT PERSONA ─────────────────────────────────────────────────────────
async function upsertPersona(persona) {
  console.log(`\n👤 Setting up ${persona.display_name} (${persona.email})...`);

  if (DRY_RUN) {
    console.log("  [DRY RUN] skipping user creation");
    return `dry-run-${persona.username}`;
  }

  // Try create
  const { data, error } = await supabase.auth.admin.createUser({
    email: persona.email,
    password: "QuizSeed2026!$",
    email_confirm: true,
  });

  let userId = data?.user?.id;

  if (error) {
    if (error.message?.includes("already")) {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users?.find((u) => u.email === persona.email);
      userId = found?.id;
      console.log(`  ↳ Already exists — ID: ${userId}`);
    } else {
      console.error(`  ↳ ❌ Auth error: ${error.message}`);
      return null;
    }
  } else {
    console.log(`  ↳ Created — ID: ${userId}`);
  }

  if (!userId) return null;

  // Upsert profile
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      username: persona.username,
      display_name: persona.display_name,
      avatar: persona.avatar,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileErr) console.warn(`  ↳ Profile warn: ${profileErr.message}`);
  else console.log(`  ↳ Profile upserted ✓`);

  return userId;
}

// ─── INSERT QUIZ + QUESTIONS ─────────────────────────────────────────────────
async function insertQuiz(quiz, creatorId) {
  const quizId = randomUUID();

  const { error: quizErr } = await supabase.from("quizzes").insert({
    id: quizId,
    title: quiz.title,
    category: quiz.category,
    emoji: quiz.emoji,
    color: quiz.color,
    creator_id: creatorId,
    is_public: true,
    plays: quiz.plays,
    created_at: quiz.created_at,
  });

  if (quizErr) {
    console.error(`    ❌ Quiz insert error: ${quizErr.message}`);
    return false;
  }

  // Insert questions
  for (let qi = 0; qi < quiz.questions.length; qi++) {
    const q = quiz.questions[qi];
    const { answers, correctIndex } = buildAnswers(q);
    const questionId = randomUUID();

    const { error: qErr } = await supabase.from("questions").insert({
      id: questionId,
      quiz_id: quizId,
      text: q.text,
      time_limit: q.difficulty === "hard" ? 30 : q.difficulty === "medium" ? 20 : 15,
      points: q.difficulty === "hard" ? 2000 : q.difficulty === "medium" ? 1000 : 500,
      order_index: qi,
    });

    if (qErr) {
      console.error(`    ❌ Question error: ${qErr.message}`);
      continue;
    }

    const answerRows = answers.map((text, ai) => ({
      id: randomUUID(),
      question_id: questionId,
      text,
      is_correct: ai === correctIndex,
    }));

    const { error: aErr } = await supabase.from("answers").insert(answerRows);
    if (aErr) console.error(`    ❌ Answers error: ${aErr.message}`);
  }

  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  console.log("🚀 QuizWorld OpenTDB Importer");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   Categories: ${Object.keys(CATEGORY_MAP).length}`);
  console.log(`   Personas: ${PERSONAS.length}\n`);

  // Step 1: Create/upsert all personas
  const personaIds = {};
  for (const persona of PERSONAS) {
    const id = await upsertPersona(persona);
    if (id) personaIds[persona.username] = { id, categories: persona.categories };
  }

  // Step 2: Build reverse map — categoryId → personaId
  const categoryToPersona = {};
  for (const [username, data] of Object.entries(personaIds)) {
    for (const catId of data.categories) {
      categoryToPersona[catId] = data.id;
    }
  }

  // Step 3: Fetch + import each category
  let totalQuizzes = 0;
  let totalQuestions = 0;
  const allCategoryIds = Object.keys(CATEGORY_MAP).map(Number);

  for (const catId of allCategoryIds) {
    const cat = CATEGORY_MAP[catId];
    const creatorId = categoryToPersona[catId];

    if (!creatorId) {
      console.warn(`\n⚠️  No persona mapped for category ${catId} (${cat.label}) — skipping`);
      continue;
    }

    console.log(`\n📂 ${cat.emoji} ${cat.label} (id=${catId})...`);

    // OpenTDB max per request is 50 — fetch in two passes for bigger categories
    let questions = [];
    const passes = catId === 9 ? 2 : 1; // General Knowledge has most questions

    for (let pass = 0; pass < passes; pass++) {
      if (!DRY_RUN) {
        await sleep(5500); // Respect OpenTDB rate limit (1 req/5s)
        const batch = await fetchCategory(catId, 50);
        questions.push(...batch);
        console.log(`  ↳ Pass ${pass + 1}: fetched ${batch.length} questions`);
      } else {
        // Dry run mock
        questions = Array(20).fill(null).map((_, i) => ({
          text: `[DRY RUN] ${cat.label} question ${i + 1}?`,
          correct: "Correct Answer",
          incorrect: ["Wrong A", "Wrong B", "Wrong C"],
          difficulty: ["easy", "medium", "hard"][i % 3],
        }));
      }
    }

    // Deduplicate by question text
    const seen = new Set();
    questions = questions.filter((q) => {
      if (seen.has(q.text)) return false;
      seen.add(q.text);
      return true;
    });

    console.log(`  ↳ ${questions.length} unique questions`);

    const quizzes = groupIntoQuizzes(questions, catId, "");
    console.log(`  ↳ → ${quizzes.length} quiz(zes) of ${QUIZ_SIZE} questions`);

    if (!DRY_RUN) {
      for (const quiz of quizzes) {
        const ok = await insertQuiz(quiz, creatorId);
        if (ok) {
          totalQuizzes++;
          totalQuestions += quiz.questions.length;
          console.log(`    ✅ "${quiz.title}" — ${quiz.questions.length}q`);
        }
      }
    } else {
      console.log(`  [DRY RUN] would insert ${quizzes.length} quizzes`);
      totalQuizzes += quizzes.length;
      totalQuestions += questions.length;
    }
  }

  console.log("\n══════════════════════════════════════");
  console.log(`✅ Import complete!`);
  console.log(`   Quizzes inserted: ${totalQuizzes}`);
  console.log(`   Questions inserted: ${totalQuestions}`);
  console.log(`   Attribution: Questions from OpenTDB (opentdb.com) — CC BY-SA 4.0`);
  console.log("══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
