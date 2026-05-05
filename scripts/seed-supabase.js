require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_QUIZZES = [
  {
    title: "World Geography Basics",
    category: "Geography",
    emoji: "🌍",
    color: "#22c55e",
    plays: 142000,
    is_public: true,
    questions: [
      {
        text: "Which is the largest continent by area?",
        time_limit: 20,
        points: 1000,
        answers: [
          { text: "Africa", is_correct: false },
          { text: "Asia", is_correct: true },
          { text: "North America", is_correct: false },
          { text: "Europe", is_correct: false },
        ],
      },
      {
        text: "What is the capital of Japan?",
        time_limit: 20,
        points: 1000,
        answers: [
          { text: "Seoul", is_correct: false },
          { text: "Beijing", is_correct: false },
          { text: "Tokyo", is_correct: true },
          { text: "Osaka", is_correct: false },
        ],
      },
    ],
  },
  {
    title: "90s Pop Culture",
    category: "Entertainment",
    emoji: "🎬",
    color: "#f97316",
    plays: 98000,
    is_public: true,
    questions: [
      {
        text: "Which console was released by Nintendo in 1996?",
        time_limit: 20,
        points: 1000,
        answers: [
          { text: "SNES", is_correct: false },
          { text: "Nintendo 64", is_correct: true },
          { text: "GameCube", is_correct: false },
          { text: "Wii", is_correct: false },
        ],
      },
      {
        text: "What movie features the quote 'There's no crying in baseball!'?",
        time_limit: 20,
        points: 1000,
        answers: [
          { text: "A League of Their Own", is_correct: true },
          { text: "Field of Dreams", is_correct: false },
          { text: "Rookie of the Year", is_correct: false },
          { text: "Bull Durham", is_correct: false },
        ],
      },
    ],
  },
];

async function seed() {
  console.log("Seeding Supabase...");
  for (const q of DEFAULT_QUIZZES) {
    const { data: quiz, error: qError } = await supabase
      .from('quizzes')
      .insert({
        title: q.title,
        category: q.category,
        emoji: q.emoji,
        color: q.color,
        plays: q.plays,
        is_public: q.is_public
      })
      .select()
      .single();

    if (qError) {
      console.error("Error inserting quiz:", qError.message);
      continue;
    }

    console.log("Inserted quiz:", quiz.title);

    for (let i = 0; i < q.questions.length; i++) {
      const question = q.questions[i];
      const { data: qs, error: qsError } = await supabase
        .from('questions')
        .insert({
          quiz_id: quiz.id,
          text: question.text,
          time_limit: question.time_limit,
          points: question.points,
          order_index: i
        })
        .select()
        .single();

      if (qsError) {
        console.error("Error inserting question:", qsError.message);
        continue;
      }

      for (const answer of question.answers) {
        await supabase
          .from('answers')
          .insert({
            question_id: qs.id,
            text: answer.text,
            is_correct: answer.is_correct
          });
      }
    }
  }
  
  console.log("Seeding complete!");
}

seed();
