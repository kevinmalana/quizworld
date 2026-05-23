/**
 * QuizWorld — Answer Repair Script
 * Finds all questions with no answers and re-inserts correct answers
 * for quizzes that came from OpenTDB (fetches fresh from API)
 * and for hand-written quizzes (re-inserts from embedded data)
 *
 * Run: export $(cat .env.local | grep -v '^#' | xargs) && node scripts/repair-answers.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = "https://tqmygnkwkjtkteguemya.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function decodeHtml(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…");
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── CATEGORY → OPENTDB ID ─────────────────────────────────────────────────
const CAT_TO_OPENTDB = {
  "General Knowledge": 9, "Books": 10, "Movies": 11, "Music": 12,
  "Television": 14, "Video Games": 15, "Board Games": 16,
  "Science & Nature": 17, "Computers": 18, "Mathematics": 19,
  "Mythology": 20, "Sports": 21, "Geography": 22, "History": 23,
  "Politics": 24, "Art": 25, "Animals": 27, "Vehicles": 28,
  "Comics": 29, "Anime & Manga": 31, "Cartoons": 32,
};

// ─── HAND-WRITTEN QUIZ ANSWERS (for quizzes NOT from OpenTDB) ─────────────
// Maps quiz title → questions with answers
const HAND_WRITTEN_ANSWERS = {
  "Stage Fright? Not Us!": [
    { text: "Which city is Broadway located in?", answers: ["Chicago","Los Angeles","New York City","Las Vegas"], correct: 2 },
    { text: "How many Tony Awards did Hamilton win at the 2016 ceremony?", answers: ["9","10","11","12"], correct: 2 },
    { text: "Which musical features the song 'Memory'?", answers: ["Chicago","Phantom of the Opera","Cats","Les Misérables"], correct: 2 },
    { text: "What Shakespeare play is West Side Story based on?", answers: ["Hamlet","A Midsummer Night's Dream","Romeo and Juliet","Othello"], correct: 2 },
    { text: "In which country did the musical Mamma Mia premiere?", answers: ["USA","Australia","UK","Sweden"], correct: 2 },
    { text: "What is the term for the area directly in front of and below the stage?", answers: ["Wings","Pit","Fly","Apron"], correct: 1 },
    { text: "Which musical is set during the French Revolution?", answers: ["Hamilton","Les Misérables","Miss Saigon","Rent"], correct: 1 },
    { text: "Who wrote the music for The Phantom of the Opera?", answers: ["Stephen Sondheim","Andrew Lloyd Webber","Lin-Manuel Miranda","Elton John"], correct: 1 },
    { text: "What does SR mean in stage directions?", answers: ["Stage Rear","Stage Right","Stage Rehearsal","Scene Reset"], correct: 1 },
    { text: "Which musical tells the story of Alexander Hamilton?", answers: ["1776","Founding Fathers","Hamilton","In the Heights"], correct: 2 },
  ],
  "Curtain Call Champions": [
    { text: "Which Shakespeare theatre was reconstructed near its original London site in 1997?", answers: ["The Rose","The Fortune","The Globe","The Curtain"], correct: 2 },
    { text: "Grease is set in which decade?", answers: ["1940s","1950s","1960s","1970s"], correct: 1 },
    { text: "Which musical features the song Defying Gravity?", answers: ["Wicked","Into the Woods","Enchanted","Rent"], correct: 0 },
    { text: "What is a soliloquy?", answers: ["A duet between two actors","A speech delivered alone on stage","A type of stage lighting","A musical overture"], correct: 1 },
    { text: "The EGOT is achieved by winning Emmy, Grammy, Oscar, and which other award?", answers: ["BAFTA","Olivier","Tony","Golden Globe"], correct: 2 },
    { text: "Which musical is based on the life of Eva Perón?", answers: ["Evita","Chicago","Cabaret","Gypsy"], correct: 0 },
    { text: "In theatre, what does breaking the fourth wall mean?", answers: ["Destroying a set piece","Addressing the audience directly","Exiting through the back","Improvising a line"], correct: 1 },
    { text: "Which city is London's West End theatre district most associated with?", answers: ["Edinburgh","Manchester","London","Birmingham"], correct: 2 },
    { text: "The musical Rent is loosely based on which opera?", answers: ["Carmen","Madama Butterfly","La Bohème","Rigoletto"], correct: 2 },
    { text: "What is a matinee?", answers: ["An evening performance","An afternoon performance","A dress rehearsal","An opening night show"], correct: 1 },
  ],
  "Star Spotting": [
    { text: "Which singer is known as the Queen of Pop?", answers: ["Whitney Houston","Beyoncé","Madonna","Mariah Carey"], correct: 2 },
    { text: "Dwayne Johnson's nickname is 'The ___'?", answers: ["Mountain","Rock","Wall","Stone"], correct: 1 },
    { text: "Which celebrity founded the production company Flower Films?", answers: ["Cameron Diaz","Drew Barrymore","Reese Witherspoon","Jennifer Aniston"], correct: 1 },
    { text: "Taylor Swift grew up in which US state?", answers: ["Tennessee","Pennsylvania","Texas","California"], correct: 1 },
    { text: "Which actor plays Tony Stark / Iron Man in the MCU?", answers: ["Chris Evans","Mark Ruffalo","Robert Downey Jr.","Jeremy Renner"], correct: 2 },
    { text: "Kim Kardashian became famous partly through a reality show called Keeping Up with the ___?", answers: ["Joneses","Kardashians","Jenners","Stars"], correct: 1 },
    { text: "Which celebrity chef is known for his Naked Chef persona?", answers: ["Gordon Ramsay","Heston Blumenthal","Jamie Oliver","Nigella Lawson"], correct: 2 },
    { text: "Elon Musk was born in which country?", answers: ["USA","Canada","South Africa","Australia"], correct: 2 },
    { text: "Rihanna is from which Caribbean island?", answers: ["Jamaica","Trinidad","Barbados","Cuba"], correct: 2 },
    { text: "Which celebrity couple was nicknamed Brangelina?", answers: ["Brad Pitt & Jennifer Aniston","Brad Pitt & Angelina Jolie","Ben Affleck & Jennifer Lopez","Ryan Reynolds & Blake Lively"], correct: 1 },
  ],
  "Famous Faces": [
    { text: "Which pop star's real name is Stefani Joanne Angelina Germanotta?", answers: ["Katy Perry","Lady Gaga","Kesha","Lorde"], correct: 1 },
    { text: "Oprah Winfrey was born in which US state?", answers: ["Illinois","Georgia","Mississippi","Tennessee"], correct: 2 },
    { text: "Which actor has played both Jack Sparrow and Edward Scissorhands?", answers: ["Jim Carrey","Johnny Depp","Nicolas Cage","Bill Murray"], correct: 1 },
    { text: "Cristiano Ronaldo is from which country?", answers: ["Spain","Brazil","Portugal","Argentina"], correct: 2 },
    { text: "Which entrepreneur co-founded Apple with Steve Jobs?", answers: ["Bill Gates","Steve Wozniak","Paul Allen","Larry Ellison"], correct: 1 },
    { text: "Jennifer Lopez is also known by what initials?", answers: ["JLo","JLope","JenniL","J-Lo"], correct: 0 },
    { text: "Which musician's alter ego was Ziggy Stardust?", answers: ["Freddie Mercury","Elton John","David Bowie","Mick Jagger"], correct: 2 },
    { text: "Adele is from which city?", answers: ["Manchester","Liverpool","Birmingham","London"], correct: 3 },
    { text: "Which celebrity authored the memoir Becoming?", answers: ["Hillary Clinton","Malala Yousafzai","Michelle Obama","Oprah Winfrey"], correct: 2 },
    { text: "Kylie Jenner founded which beauty brand?", answers: ["Fenty Beauty","Rare Beauty","Kylie Cosmetics","NARS"], correct: 2 },
  ],
  "Gadget Guru": [
    { text: "What does OLED stand for in display technology?", answers: ["Optical Light Emitting Device","Organic Light Emitting Diode","Over-Layer Electronic Display","Open Light Emission Design"], correct: 1 },
    { text: "Which company makes the Galaxy smartphone series?", answers: ["Apple","Sony","Samsung","Huawei"], correct: 2 },
    { text: "What technology allows phones to pay contactlessly in stores?", answers: ["Bluetooth","Wi-Fi","NFC","GPS"], correct: 2 },
    { text: "What does SSD stand for?", answers: ["Solid State Drive","Super Speed Disk","System Storage Device","Sequential Sync Drive"], correct: 0 },
    { text: "AirPods are made by which company?", answers: ["Samsung","Sony","Bose","Apple"], correct: 3 },
    { text: "Which smart home speaker is made by Amazon?", answers: ["Google Home","HomePod","Echo","Nest Hub"], correct: 2 },
    { text: "What does RAM stand for in computing?", answers: ["Random Access Memory","Read And Monitor","Rapid Application Mode","Real-time Access Module"], correct: 0 },
    { text: "The Apple Watch runs which operating system?", answers: ["iOS","iPadOS","watchOS","macOS"], correct: 2 },
    { text: "Which company makes the PlayStation gaming console?", answers: ["Microsoft","Nintendo","Sony","Sega"], correct: 2 },
    { text: "What is the name of Tesla's self-driving technology feature?", answers: ["AutoDrive","Autopilot","SmartSteer","CruiseAI"], correct: 1 },
  ],
  "Tech Specs & Specs": [
    { text: "What generation of wireless technology is 5G named after?", answers: ["3rd","4th","5th","6th"], correct: 2 },
    { text: "Which company invented the first commercially successful smartwatch?", answers: ["Apple","Samsung","Pebble","Sony"], correct: 2 },
    { text: "USB-C is notable for being which of the following?", answers: ["Larger than USB-A","One-directional only","Reversible","Wireless only"], correct: 2 },
    { text: "What is the maximum resolution called that is four times Full HD?", answers: ["2K","4K","8K","16K"], correct: 1 },
    { text: "Google's mobile OS is called what?", answers: ["iOS","HarmonyOS","Android","Symbian"], correct: 2 },
    { text: "Which tech giant owns the Pixel smartphone brand?", answers: ["Meta","Microsoft","Amazon","Google"], correct: 3 },
    { text: "What does IoT stand for?", answers: ["Internet of Things","Integration of Technology","Input Output Terminal","Internal Operating Thread"], correct: 0 },
    { text: "Which company makes the Surface range of laptops and tablets?", answers: ["Apple","Dell","Microsoft","HP"], correct: 2 },
    { text: "What is the name of Apple's voice assistant?", answers: ["Alexa","Cortana","Bixby","Siri"], correct: 3 },
    { text: "A drone in tech is best described as what?", answers: ["An underground server","An unmanned aerial vehicle","A background software process","A type of battery"], correct: 1 },
  ],
  "Social Media IQ": [
    { text: "Which platform introduced the concept of Stories that disappear after 24 hours?", answers: ["Twitter","Snapchat","Instagram","TikTok"], correct: 1 },
    { text: "What does DM stand for on social media?", answers: ["Direct Message","Digital Media","Daily Memo","Deleted Message"], correct: 0 },
    { text: "Which platform is known for its algorithm-driven For You Page?", answers: ["Instagram","YouTube","TikTok","Twitter"], correct: 2 },
    { text: "What was Twitter rebranded to in 2023?", answers: ["T","Xitter","X","Twit"], correct: 2 },
    { text: "What is the maximum length of a standard tweet in characters?", answers: ["140","240","280","320"], correct: 2 },
    { text: "YouTube was acquired by which company in 2006?", answers: ["Meta","Amazon","Microsoft","Google"], correct: 3 },
    { text: "What is a hashtag used for on social media?", answers: ["Marking a post as private","Linking to an external website","Categorising content by topic","Tagging another user"], correct: 2 },
    { text: "Which platform has a Retweet feature?", answers: ["Instagram","Facebook","X (Twitter)","LinkedIn"], correct: 2 },
    { text: "What does going viral mean?", answers: ["A post gets deleted","Content spreads rapidly across the internet","A user gets banned","A platform crashes"], correct: 1 },
    { text: "LinkedIn is primarily used for what purpose?", answers: ["Gaming","Professional networking","Video sharing","Dating"], correct: 1 },
  ],
  "Crypto & Web3 Basics": [
    { text: "Bitcoin was created by the pseudonymous person or group known as?", answers: ["Elon Musk","Satoshi Nakamoto","Vitalik Buterin","Nick Szabo"], correct: 1 },
    { text: "What does NFT stand for?", answers: ["New Financial Token","Non-Fungible Token","Network File Transfer","Next Finance Technology"], correct: 1 },
    { text: "Ethereum's native currency is called?", answers: ["Bitcoin","Litecoin","Ether","Ripple"], correct: 2 },
    { text: "A blockchain is best described as?", answers: ["A type of social network","A distributed ledger of transactions","A cloud storage service","A programming language"], correct: 1 },
    { text: "What is a crypto wallet used for?", answers: ["Mining new coins","Storing physical cash","Storing and managing digital assets","Printing NFTs"], correct: 2 },
    { text: "What does HODL mean in crypto slang?", answers: ["Sell immediately","Hold on for dear life — keep your assets","Hack or disrupt a ledger","High output digital leverage"], correct: 1 },
    { text: "Which process involves verifying transactions on a blockchain in exchange for rewards?", answers: ["Staking","Mining","Minting","Bridging"], correct: 1 },
    { text: "What is a smart contract?", answers: ["A legal document signed digitally","Self-executing code stored on a blockchain","A type of hardware wallet","An AI trading bot"], correct: 1 },
    { text: "Bitcoin has a maximum supply cap of how many coins?", answers: ["10 million","18 million","21 million","100 million"], correct: 2 },
    { text: "What is a rug pull in crypto?", answers: ["A technical bug in a blockchain","When developers abandon a project after taking investors funds","A type of market rally","A hardware wallet malfunction"], correct: 1 },
  ],
  "G'Day Australia!": [
    { text: "What is the capital city of Australia?", answers: ["Sydney","Melbourne","Brisbane","Canberra"], correct: 3 },
    { text: "Which Australian state is home to the Great Barrier Reef?", answers: ["New South Wales","Victoria","Queensland","Western Australia"], correct: 2 },
    { text: "What is the name of the large rock formation in the Northern Territory sacred to Aboriginal Australians?", answers: ["Mount Kosciuszko","Uluru","Devils Marbles","The Olgas"], correct: 1 },
    { text: "Australia's currency is the?", answers: ["Australian Pound","Australian Dollar","Aussie Franc","Pacific Dollar"], correct: 1 },
    { text: "What does the Australian slang arvo mean?", answers: ["Morning","Evening","Afternoon","Tomorrow"], correct: 2 },
    { text: "Which city is Australia's most populous?", answers: ["Canberra","Melbourne","Brisbane","Sydney"], correct: 3 },
    { text: "What is the name of the strait separating Australia from Tasmania?", answers: ["Cook Strait","Torres Strait","Bass Strait","Tasman Strait"], correct: 2 },
    { text: "Australia is the world's ___ largest country by area?", answers: ["4th","5th","6th","7th"], correct: 2 },
    { text: "Which Australian landmark was designed by Danish architect Jørn Utzon?", answers: ["Melbourne Cricket Ground","Sydney Harbour Bridge","Sydney Opera House","Parliament House"], correct: 2 },
    { text: "What animal appears on the Australian coat of arms alongside the emu?", answers: ["Kangaroo","Koala","Wombat","Platypus"], correct: 0 },
  ],
  "Bon Appétit — Global Edition": [
    { text: "Sushi originated in which country?", answers: ["China","Japan","Korea","Vietnam"], correct: 1 },
    { text: "Which spice gives turmeric its distinctive yellow colour?", answers: ["Curcumin","Saffron","Paprika","Annatto"], correct: 0 },
    { text: "Paella is a traditional dish from which country?", answers: ["Italy","Portugal","Spain","Greece"], correct: 2 },
    { text: "What type of pasta is shaped like small rice grains?", answers: ["Penne","Fusilli","Orzo","Farfalle"], correct: 2 },
    { text: "Croissants are most associated with which country?", answers: ["France","Belgium","Austria","Switzerland"], correct: 0 },
    { text: "Which country is the largest producer of coffee in the world?", answers: ["Colombia","Ethiopia","Vietnam","Brazil"], correct: 3 },
    { text: "Guacamole is made primarily from which fruit?", answers: ["Tomato","Avocado","Lime","Mango"], correct: 1 },
    { text: "What is the main ingredient in hummus?", answers: ["Lentils","Black beans","Chickpeas","Edamame"], correct: 2 },
    { text: "Which country invented the dish Pho?", answers: ["Thailand","Vietnam","Cambodia","Laos"], correct: 1 },
    { text: "What does al dente mean when cooking pasta?", answers: ["Fully soft","With sauce","Firm to the bite","Well done"], correct: 2 },
  ],
  "To Infinity & Beyond": [
    { text: "Which planet in our solar system has the most moons?", answers: ["Jupiter","Saturn","Uranus","Neptune"], correct: 1 },
    { text: "What is the name of NASA's most famous space telescope, launched in 1990?", answers: ["James Webb","Kepler","Spitzer","Hubble"], correct: 3 },
    { text: "The first human to walk on the Moon was?", answers: ["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"], correct: 2 },
    { text: "Elon Musk's private space company is called?", answers: ["Blue Origin","Virgin Galactic","SpaceX","Rocket Lab"], correct: 2 },
    { text: "What is the closest star to our solar system?", answers: ["Sirius","Betelgeuse","Proxima Centauri","Vega"], correct: 2 },
    { text: "What is a light-year a measure of?", answers: ["Time","Speed","Distance","Brightness"], correct: 2 },
    { text: "The International Space Station orbits Earth at approximately what altitude?", answers: ["100 km","200 km","400 km","800 km"], correct: 2 },
    { text: "What is the name of Mars's largest volcano?", answers: ["Olympus Mons","Elysium Mons","Alba Mons","Pavonis Mons"], correct: 0 },
    { text: "Which mission first landed humans on the Moon?", answers: ["Apollo 10","Apollo 11","Apollo 12","Gemini 8"], correct: 1 },
    { text: "The James Webb Space Telescope primarily observes in which type of light?", answers: ["Ultraviolet","X-ray","Infrared","Visible"], correct: 2 },
  ],
};

// ─── FETCH FRESH QUESTIONS FROM OPENTDB ────────────────────────────────────
async function fetchOpenTDB(categoryId, amount = 50) {
  await sleep(5500);
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${categoryId}&type=multiple&encode=url3986`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.response_code !== 0) return [];
  return data.results.map(q => ({
    text: decodeURIComponent(q.question),
    correct: decodeURIComponent(q.correct_answer),
    incorrect: q.incorrect_answers.map(decodeURIComponent),
    difficulty: q.difficulty,
  }));
}

// ─── INSERT ANSWERS FOR EXISTING QUESTIONS ─────────────────────────────────
async function insertAnswersForQuestion(questionId, answers, correctIndex) {
  const rows = answers.map((text, i) => ({
    id: randomUUID(),
    question_id: questionId,
    text,
    is_correct: i === correctIndex,
  }));
  const { error } = await sb.from("answers").insert(rows);
  if (error) console.error(`    ❌ Answers error for ${questionId}: ${error.message}`);
  return !error;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function run() {
  console.log("🔧 QuizWorld Answer Repair Script\n");

  // Get all questions with no answers
  const { data: allQuestions } = await sb.from("questions").select("id,quiz_id,text,order_index");
  const { data: allAnswers } = await sb.from("answers").select("question_id");
  const answered = new Set(allAnswers.map(a => a.question_id));
  const broken = allQuestions.filter(q => !answered.has(q.id));

  console.log(`Found ${broken.length} questions with no answers across ${new Set(broken.map(q=>q.quiz_id)).size} quizzes\n`);

  // Get quiz metadata for broken questions
  const brokenQuizIds = [...new Set(broken.map(q => q.quiz_id))];
  const { data: brokenQuizzes } = await sb.from("quizzes").select("id,title,category").in("id", brokenQuizIds);
  const quizMap = Object.fromEntries(brokenQuizzes.map(q => [q.id, q]));

  // Group broken questions by quiz
  const byQuiz = {};
  broken.forEach(q => {
    if (!byQuiz[q.quiz_id]) byQuiz[q.quiz_id] = [];
    byQuiz[q.quiz_id].push(q);
  });

  let fixed = 0;
  let skipped = 0;

  for (const [quizId, questions] of Object.entries(byQuiz)) {
    const quiz = quizMap[quizId];
    if (!quiz) continue;

    console.log(`\n📂 "${quiz.title}" (${quiz.category}) — ${questions.length} broken questions`);
    questions.sort((a, b) => a.order_index - b.order_index);

    // Strategy 1: Hand-written answers
    if (HAND_WRITTEN_ANSWERS[quiz.title]) {
      const handWritten = HAND_WRITTEN_ANSWERS[quiz.title];
      for (const q of questions) {
        // Match by order_index
        const hw = handWritten[q.order_index];
        if (!hw) { console.warn(`  ⚠️  No hand-written answer for order_index ${q.order_index}`); skipped++; continue; }
        const ok = await insertAnswersForQuestion(q.id, hw.answers, hw.correct);
        if (ok) fixed++;
      }
      continue;
    }

    // Strategy 2: OpenTDB re-fetch
    const catId = CAT_TO_OPENTDB[quiz.category];
    if (!catId) {
      console.warn(`  ⚠️  No OpenTDB category mapping for "${quiz.category}" — skipping`);
      skipped += questions.length;
      continue;
    }

    console.log(`  → Fetching fresh questions from OpenTDB (category ${catId})...`);
    const freshQuestions = await fetchOpenTDB(catId, 50);

    if (freshQuestions.length === 0) {
      console.warn(`  ⚠️  OpenTDB returned 0 questions`);
      skipped += questions.length;
      continue;
    }

    // Match by question text similarity or use fresh questions by index
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Try text match first
      let match = freshQuestions.find(f => f.text === q.text);
      // Fallback: use fresh question at same position
      if (!match) match = freshQuestions[i % freshQuestions.length];
      if (!match) { skipped++; continue; }

      const allAnswers = shuffle([match.correct, ...match.incorrect]);
      const correctIdx = allAnswers.indexOf(match.correct);

      // Update question text if we're using a fresh question
      if (match.text !== q.text) {
        await sb.from("questions").update({ text: match.text }).eq("id", q.id);
      }

      const ok = await insertAnswersForQuestion(q.id, allAnswers, correctIdx);
      if (ok) fixed++;
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`✅ Repair complete`);
  console.log(`   Fixed: ${fixed} questions`);
  console.log(`   Skipped: ${skipped} questions`);
  console.log(`══════════════════════════════════════\n`);
}

run().catch(console.error);
