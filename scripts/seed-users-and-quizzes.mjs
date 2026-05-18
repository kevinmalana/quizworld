/**
 * QuizWorld Seeder — 10 fake users + 10 quizzes
 * Run: node scripts/seed-users-and-quizzes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = "https://tqmygnkwkjtkteguemya.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 10 seed personas
const PERSONAS = [
  { username: "trivia_tim",    display_name: "Trivia Tim",       avatar: "🧠", email: "trivia_tim@quizworld.xyz" },
  { username: "sciencesarah",  display_name: "Science Sarah",    avatar: "🔬", email: "sciencesarah@quizworld.xyz" },
  { username: "historyhenry",  display_name: "History Henry",    avatar: "📜", email: "historyhenry@quizworld.xyz" },
  { username: "geoquiz_gina",  display_name: "Geo Quiz Gina",    avatar: "🌍", email: "geoquiz_gina@quizworld.xyz" },
  { username: "popculture_pat",display_name: "Pop Culture Pat",  avatar: "🌟", email: "popculture_pat@quizworld.xyz" },
  { username: "sportsfan_sam", display_name: "Sports Fan Sam",   avatar: "⚽", email: "sportsfan_sam@quizworld.xyz" },
  { username: "techquiz_tony", display_name: "Tech Quiz Tony",   avatar: "💻", email: "techquiz_tony@quizworld.xyz" },
  { username: "foodie_fran",   display_name: "Foodie Fran",      avatar: "🍕", email: "foodie_fran@quizworld.xyz" },
  { username: "movie_mia",     display_name: "Movie Mia",        avatar: "🎬", email: "movie_mia@quizworld.xyz" },
  { username: "music_max",     display_name: "Music Max",        avatar: "🎵", email: "music_max@quizworld.xyz" },
];

// 10 quizzes — one per persona
const QUIZZES = [
  {
    title: "Ultimate General Trivia",
    category: "Trivia",
    description: "A mix of fun facts from every corner of the world.",
    plays: 14,
    questions: [
      { text: "What is the capital of Australia?", answers: ["Canberra","Sydney","Melbourne","Brisbane"], correct: 0 },
      { text: "How many sides does a hexagon have?", answers: ["5","6","7","8"], correct: 1 },
      { text: "Which planet is known as the Red Planet?", answers: ["Venus","Jupiter","Mars","Saturn"], correct: 2 },
      { text: "Who painted the Mona Lisa?", answers: ["Michelangelo","Raphael","Leonardo da Vinci","Donatello"], correct: 2 },
      { text: "What is the chemical symbol for gold?", answers: ["Ag","Fe","Au","Pb"], correct: 2 },
      { text: "How many bones are in the adult human body?", answers: ["196","206","216","226"], correct: 1 },
      { text: "Which ocean is the largest?", answers: ["Atlantic","Indian","Arctic","Pacific"], correct: 3 },
      { text: "What year did World War II end?", answers: ["1943","1944","1945","1946"], correct: 2 },
      { text: "What is the fastest land animal?", answers: ["Lion","Cheetah","Horse","Greyhound"], correct: 1 },
      { text: "Which country invented the printing press?", answers: ["China","England","Germany","France"], correct: 2 },
    ],
  },
  {
    title: "Science Fundamentals",
    category: "Science & Nature",
    description: "Test your knowledge of basic science principles.",
    plays: 9,
    questions: [
      { text: "What is the powerhouse of the cell?", answers: ["Nucleus","Ribosome","Mitochondria","Chloroplast"], correct: 2 },
      { text: "What gas do plants absorb from the atmosphere?", answers: ["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"], correct: 2 },
      { text: "What is the speed of light (approx)?", answers: ["300,000 km/s","150,000 km/s","450,000 km/s","30,000 km/s"], correct: 0 },
      { text: "What is H2O more commonly known as?", answers: ["Salt","Water","Oxygen","Hydrogen"], correct: 1 },
      { text: "How many chromosomes do humans have?", answers: ["23","36","46","48"], correct: 2 },
      { text: "What force keeps planets in orbit around the Sun?", answers: ["Magnetism","Friction","Gravity","Nuclear force"], correct: 2 },
      { text: "What is the atomic number of Carbon?", answers: ["4","6","8","12"], correct: 1 },
      { text: "Which organ produces insulin?", answers: ["Liver","Kidney","Pancreas","Stomach"], correct: 2 },
      { text: "What type of wave is sound?", answers: ["Transverse","Electromagnetic","Longitudinal","Gamma"], correct: 2 },
      { text: "What is the most abundant gas in Earth's atmosphere?", answers: ["Oxygen","Carbon Dioxide","Argon","Nitrogen"], correct: 3 },
    ],
  },
  {
    title: "World History Challenge",
    category: "History",
    description: "From ancient civilisations to modern events.",
    plays: 7,
    questions: [
      { text: "In what year did the Berlin Wall fall?", answers: ["1987","1989","1991","1993"], correct: 1 },
      { text: "Which empire was ruled by Julius Caesar?", answers: ["Greek","Ottoman","Roman","Byzantine"], correct: 2 },
      { text: "Who was the first US President?", answers: ["Abraham Lincoln","Thomas Jefferson","John Adams","George Washington"], correct: 3 },
      { text: "What ancient wonder was located in Alexandria?", answers: ["Colossus","Hanging Gardens","Great Lighthouse","Statue of Zeus"], correct: 2 },
      { text: "Which war was fought between the North and South US states?", answers: ["Revolutionary War","Civil War","War of 1812","Mexican-American War"], correct: 1 },
      { text: "Who was the first man to walk on the Moon?", answers: ["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"], correct: 2 },
      { text: "In which country did the Industrial Revolution begin?", answers: ["France","Germany","USA","England"], correct: 3 },
      { text: "What year did World War I begin?", answers: ["1912","1914","1916","1918"], correct: 1 },
      { text: "Who wrote the Communist Manifesto?", answers: ["Lenin","Stalin","Marx and Engels","Trotsky"], correct: 2 },
      { text: "Which civilisation built Machu Picchu?", answers: ["Aztec","Maya","Inca","Olmec"], correct: 2 },
    ],
  },
  {
    title: "Geography Around the World",
    category: "Geography",
    description: "How well do you know our planet's countries and capitals?",
    plays: 11,
    questions: [
      { text: "What is the capital of Japan?", answers: ["Osaka","Kyoto","Hiroshima","Tokyo"], correct: 3 },
      { text: "Which is the longest river in the world?", answers: ["Amazon","Yangtze","Mississippi","Nile"], correct: 3 },
      { text: "Which country has the most natural lakes?", answers: ["USA","Russia","Brazil","Canada"], correct: 3 },
      { text: "What is the smallest country in the world?", answers: ["Monaco","San Marino","Liechtenstein","Vatican City"], correct: 3 },
      { text: "Which continent is the Sahara Desert on?", answers: ["Asia","Australia","South America","Africa"], correct: 3 },
      { text: "What country has the most coastline?", answers: ["Norway","Australia","Russia","Canada"], correct: 3 },
      { text: "What is the capital of Brazil?", answers: ["Rio de Janeiro","São Paulo","Brasília","Salvador"], correct: 2 },
      { text: "Which mountain range contains Mount Everest?", answers: ["Andes","Alps","Rockies","Himalayas"], correct: 3 },
      { text: "Which country is home to the Great Barrier Reef?", answers: ["Philippines","Indonesia","New Zealand","Australia"], correct: 3 },
      { text: "What is the capital of Canada?", answers: ["Toronto","Vancouver","Ottawa","Montreal"], correct: 2 },
    ],
  },
  {
    title: "Pop Culture Extravaganza",
    category: "Pop Culture",
    description: "Movies, memes, celebs and everything in between.",
    plays: 18,
    questions: [
      { text: "Which app is known for short-form videos and the 'For You' page?", answers: ["Instagram","Snapchat","TikTok","YouTube"], correct: 2 },
      { text: "Who plays Iron Man in the MCU?", answers: ["Chris Evans","Chris Hemsworth","Robert Downey Jr.","Mark Ruffalo"], correct: 2 },
      { text: "What show features dragons and the Iron Throne?", answers: ["Vikings","The Witcher","Rings of Power","Game of Thrones"], correct: 3 },
      { text: "Which artist released the album '1989'?", answers: ["Ariana Grande","Katy Perry","Taylor Swift","Billie Eilish"], correct: 2 },
      { text: "What is the highest-grossing film of all time?", answers: ["Titanic","Avengers: Endgame","Avatar","Star Wars: The Force Awakens"], correct: 2 },
      { text: "Which TV show popularised the phrase 'Winter is Coming'?", answers: ["Westworld","Stranger Things","Breaking Bad","Game of Thrones"], correct: 3 },
      { text: "Who is known as the 'Queen of Pop'?", answers: ["Beyoncé","Rihanna","Madonna","Lady Gaga"], correct: 2 },
      { text: "What colour is the Grinch?", answers: ["Red","Blue","Yellow","Green"], correct: 3 },
      { text: "Which social network uses a bird as its logo (original)?", answers: ["Facebook","LinkedIn","Twitter","Pinterest"], correct: 2 },
      { text: "Who voiced Woody in Toy Story?", answers: ["Tom Hanks","Tim Allen","Billy Crystal","John Travolta"], correct: 0 },
    ],
  },
  {
    title: "Sports Trivia Showdown",
    category: "Sports",
    description: "For fans of the beautiful game and beyond.",
    plays: 22,
    questions: [
      { text: "Which country has won the most FIFA World Cups?", answers: ["Germany","Argentina","Italy","Brazil"], correct: 3 },
      { text: "How many players are on a basketball team on court at once?", answers: ["4","5","6","7"], correct: 1 },
      { text: "In tennis, what is a score of zero called?", answers: ["Nil","Void","Love","Zero"], correct: 2 },
      { text: "Which sport uses a shuttlecock?", answers: ["Squash","Badminton","Tennis","Ping Pong"], correct: 1 },
      { text: "How many rings are on the Olympic flag?", answers: ["4","5","6","7"], correct: 1 },
      { text: "Which country hosted the 2016 Summer Olympics?", answers: ["China","UK","Brazil","Japan"], correct: 2 },
      { text: "What is the national sport of Japan?", answers: ["Judo","Kendo","Sumo","Karate"], correct: 2 },
      { text: "In cricket, how many balls are in an over?", answers: ["4","5","6","8"], correct: 2 },
      { text: "Which F1 driver has the most World Championships?", answers: ["Ayrton Senna","Michael Schumacher","Lewis Hamilton","Sebastian Vettel"], correct: 2 },
      { text: "How long is a standard marathon (km)?", answers: ["40km","42.195km","44km","45km"], correct: 1 },
    ],
  },
  {
    title: "Tech & Computers Quiz",
    category: "Technology",
    description: "From coding basics to big tech giants.",
    plays: 13,
    questions: [
      { text: "What does CPU stand for?", answers: ["Central Processing Unit","Computer Personal Unit","Core Processing Utility","Central Program Unit"], correct: 0 },
      { text: "Which company created the iPhone?", answers: ["Samsung","Google","Microsoft","Apple"], correct: 3 },
      { text: "What does HTML stand for?", answers: ["Hyper Text Markup Language","High Tech Modern Language","Hyper Transfer Markup Logic","Home Tool Markup Language"], correct: 0 },
      { text: "Which programming language is known for its snake logo?", answers: ["Ruby","Java","Python","Perl"], correct: 2 },
      { text: "What does 'www' stand for in a website URL?", answers: ["World Wide Web","Wide Web World","Web World Wide","Worldwide Website"], correct: 0 },
      { text: "Which company owns Android?", answers: ["Apple","Microsoft","Amazon","Google"], correct: 3 },
      { text: "What is the binary representation of the number 5?", answers: ["011","100","101","110"], correct: 2 },
      { text: "Which social network was founded by Mark Zuckerberg?", answers: ["Twitter","LinkedIn","Facebook","Snapchat"], correct: 2 },
      { text: "What does USB stand for?", answers: ["Universal Serial Bus","Universal System Backup","Unified Serial Bus","Universal Software Bridge"], correct: 0 },
      { text: "Which company makes the PlayStation?", answers: ["Microsoft","Nintendo","Sega","Sony"], correct: 3 },
    ],
  },
  {
    title: "Food & Drink Around the World",
    category: "Food & Drink",
    description: "A delicious quiz for foodies everywhere.",
    plays: 8,
    questions: [
      { text: "Which country is sushi originally from?", answers: ["China","Korea","Thailand","Japan"], correct: 3 },
      { text: "What is the main ingredient in guacamole?", answers: ["Tomato","Avocado","Lime","Onion"], correct: 1 },
      { text: "Which country is famous for inventing pizza?", answers: ["Spain","Greece","France","Italy"], correct: 3 },
      { text: "What is the spiciest chilli in the world (as of 2024)?", answers: ["Carolina Reaper","Ghost Pepper","Pepper X","Habanero"], correct: 2 },
      { text: "What beverage is known as 'liquid gold' in Ethiopia?", answers: ["Tea","Wine","Beer","Coffee"], correct: 3 },
      { text: "What type of pastry is a croissant?", answers: ["Choux","Filo","Puff","Shortcrust"], correct: 2 },
      { text: "Which nut is used to make marzipan?", answers: ["Hazelnut","Walnut","Pistachio","Almond"], correct: 3 },
      { text: "What is the base of a traditional Caesar salad dressing?", answers: ["Olive oil","Mayonnaise","Yoghurt","Vinegar"], correct: 1 },
      { text: "Sake is a traditional alcoholic drink from which country?", answers: ["China","Vietnam","Japan","Korea"], correct: 2 },
      { text: "What fruit is used to make wine?", answers: ["Apple","Grape","Plum","Cherry"], correct: 1 },
    ],
  },
  {
    title: "Movies & Cinema Classics",
    category: "Movies",
    description: "Lights, camera, trivia!",
    plays: 16,
    questions: [
      { text: "Who directed Jurassic Park?", answers: ["James Cameron","Christopher Nolan","Steven Spielberg","Ridley Scott"], correct: 2 },
      { text: "What film features the quote 'I'll be back'?", answers: ["RoboCop","Total Recall","The Terminator","Predator"], correct: 2 },
      { text: "In which film does a clownfish search for his son?", answers: ["Shark Tale","The Little Mermaid","Finding Nemo","Moana"], correct: 2 },
      { text: "What is the name of the toy cowboy in Toy Story?", answers: ["Buzz","Rex","Woody","Hamm"], correct: 2 },
      { text: "Which actor plays Jack Sparrow in Pirates of the Caribbean?", answers: ["Orlando Bloom","Will Smith","Johnny Depp","Keira Knightley"], correct: 2 },
      { text: "What year was the first Star Wars film released?", answers: ["1975","1977","1979","1981"], correct: 1 },
      { text: "Which film won the first Academy Award for Best Picture?", answers: ["Gone with the Wind","It Happened One Night","Wings","Casablanca"], correct: 2 },
      { text: "Who plays Katniss Everdeen in The Hunger Games?", answers: ["Emma Stone","Scarlett Johansson","Jennifer Lawrence","Kristen Stewart"], correct: 2 },
      { text: "What is the highest-grossing animated film of all time?", answers: ["Frozen II","The Lion King","Incredibles 2","The Super Mario Bros. Movie"], correct: 1 },
      { text: "Which director made Inception and The Dark Knight?", answers: ["Zack Snyder","J.J. Abrams","Christopher Nolan","Denis Villeneuve"], correct: 2 },
    ],
  },
  {
    title: "Music Through the Decades",
    category: "Music",
    description: "From the 60s to today — how well do you know your music?",
    plays: 12,
    questions: [
      { text: "Which band performed 'Bohemian Rhapsody'?", answers: ["The Beatles","Led Zeppelin","Queen","Rolling Stones"], correct: 2 },
      { text: "Who is known as the King of Pop?", answers: ["Elvis Presley","Prince","Justin Timberlake","Michael Jackson"], correct: 3 },
      { text: "Which instrument has 88 keys?", answers: ["Organ","Harpsichord","Piano","Synthesizer"], correct: 2 },
      { text: "What genre is Kendrick Lamar known for?", answers: ["R&B","Pop","Jazz","Hip-Hop"], correct: 3 },
      { text: "Which country is K-pop originally from?", answers: ["Japan","China","Taiwan","South Korea"], correct: 3 },
      { text: "Who sang 'Rolling in the Deep'?", answers: ["Beyoncé","Rihanna","Adele","Amy Winehouse"], correct: 2 },
      { text: "What instrument does a DJ primarily use?", answers: ["Guitar","Turntable","Keyboard","Drum kit"], correct: 1 },
      { text: "How many strings does a standard guitar have?", answers: ["4","5","6","7"], correct: 2 },
      { text: "Which band released 'Stairway to Heaven'?", answers: ["Pink Floyd","The Doors","Led Zeppelin","Black Sabbath"], correct: 2 },
      { text: "What is the best-selling album of all time?", answers: ["Back in Black","Thriller","The Dark Side of the Moon","Hotel California"], correct: 1 },
    ],
  },
];

async function run() {
  console.log("🌱 Starting QuizWorld seeder...\n");

  for (let i = 0; i < PERSONAS.length; i++) {
    const persona = PERSONAS[i];
    const quiz = QUIZZES[i];

    // 1. Create auth user
    console.log(`Creating user: ${persona.username}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: persona.email,
      password: "QuizWorld2026!",
      email_confirm: true,
    });

    if (authError) {
      // May already exist — try to find them
      if (authError.message?.includes("already")) {
        console.log(`  ↳ User already exists, skipping user creation`);
      } else {
        console.error(`  ↳ Auth error: ${authError.message}`);
        continue;
      }
    }

    const userId = authData?.user?.id;

    // Find user ID if creation was skipped
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const found = users?.users?.find(u => u.email === persona.email);
      resolvedUserId = found?.id;
    }

    if (!resolvedUserId) {
      console.error(`  ↳ Could not resolve user ID for ${persona.email}`);
      continue;
    }

    console.log(`  ↳ User ID: ${resolvedUserId}`);

    // 2. Upsert profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: resolvedUserId,
      username: persona.username,
      display_name: persona.display_name,
      avatar: persona.avatar,
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) console.warn(`  ↳ Profile warn: ${profileError.message}`);
    else console.log(`  ↳ Profile upserted: ${persona.display_name}`);

    // 3. Insert quiz
    const quizId = randomUUID();
    const { error: quizError } = await supabase.from("quizzes").insert({
      id: quizId,
      title: quiz.title,
      category: quiz.category,
      creator_id: resolvedUserId,
      is_public: true,
      archived_at: null,
      plays: quiz.plays,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (quizError) {
      console.error(`  ↳ Quiz error: ${quizError.message}`);
      continue;
    }
    console.log(`  ↳ Quiz inserted: "${quiz.title}" (${quizId})`);

    // 4. Insert questions + answers
    for (let qi = 0; qi < quiz.questions.length; qi++) {
      const q = quiz.questions[qi];
      const questionId = randomUUID();

      const { error: qError } = await supabase.from("questions").insert({
        id: questionId,
        quiz_id: quizId,
        text: q.text,
        question_type: "multiple_choice",
        time_limit: 20,
        points: 1000,
        order_index: qi,
      });

      if (qError) {
        console.error(`    ↳ Question error: ${qError.message}`);
        continue;
      }

      // Insert answers
      const answers = q.answers.map((text, ai) => ({
        id: randomUUID(),
        question_id: questionId,
        text,
        is_correct: ai === q.correct,
      }));

      const { error: aError } = await supabase.from("answers").insert(answers);
      if (aError) console.error(`    ↳ Answers error: ${aError.message}`);
    }

    console.log(`  ↳ ✅ ${quiz.questions.length} questions inserted\n`);
  }

  console.log("🎉 Seeding complete!");
}

run().catch(console.error);
