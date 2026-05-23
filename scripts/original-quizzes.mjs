/**
 * QuizWorld — Original Hand-Written Quiz Content
 * - Renames generic "#1/#2" titles to creative names
 * - Fills 3 missing categories: Musicals & Theatre, Celebrities, Gadgets & Tech
 * - Adds 5 featured original quizzes on modern topics
 *
 * Run: cd quizworld && export $(cat .env.local | grep -v '^#' | xargs) && node scripts/original-quizzes.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = "https://tqmygnkwkjtkteguemya.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ALEX   = "0e289696-af31-44f6-8ed1-4317ae0d1d41"; // General/History/Politics/Mythology
const JAMIE  = "b6a4b833-a5d2-451c-aaab-32cf14b0bf79"; // Movies/Music/TV/Comics/Anime
const SAM    = "658e967d-6acc-48f3-a044-858725c63f6f"; // Sports/Geography/Animals/Vehicles
const TAYLOR = "008e12cd-733e-427e-a40b-8815e4d88652"; // Science/Computers/Maths/Gaming
const MORGAN = "bf120652-9098-4e9e-8307-9d95cac42292"; // Books/Board Games/Art/Musicals

function rando(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate() { return new Date(Date.now() - rando(1, 60) * 86400000).toISOString(); }

// ─── TITLE RENAME MAP ──────────────────────────────────────────────────────
// Maps pattern "Category Trivia #N" → creative title
const RENAME_MAP = {
  "General Knowledge Trivia #1": "World Facts Blitz",
  "General Knowledge Trivia #2": "The Big Brain Challenge",
  "General Knowledge Trivia #3": "Trivia Vault",
  "General Knowledge Trivia #4": "Know It All",
  "General Knowledge Trivia #5": "Fact Attack",
  "General Knowledge Trivia #6": "Mind Bender",
  "General Knowledge Trivia #7": "The Ultimate Trivia Gauntlet",
  "General Knowledge Trivia #8": "Sharp Minds Only",
  "General Knowledge Trivia #9": "Random Genius",
  "Books Trivia #1": "Between the Covers",
  "Books Trivia #2": "Page Turner Challenge",
  "Books Trivia #3": "Bookworm's Den",
  "Books Trivia #4": "Classic Reads",
  "Books Trivia #5": "Literary Lions",
  "Movies Trivia #1": "Lights, Camera, Action!",
  "Movies Trivia #2": "Silver Screen Quiz",
  "Movies Trivia #3": "Box Office Legends",
  "Movies Trivia #4": "Scene Stealers",
  "Movies Trivia #5": "Hollywood or Bust",
  "Movies Trivia #6": "Directors Cut",
  "Music Trivia #1": "Chart Toppers",
  "Music Trivia #2": "On Repeat",
  "Music Trivia #3": "Melody Masters",
  "Music Trivia #4": "Bass Drop Trivia",
  "Music Trivia #5": "Stage & Studio",
  "Television Trivia #1": "Remote Control",
  "Television Trivia #2": "Binge Watch Champion",
  "Television Trivia #3": "Prime Time Quiz",
  "Television Trivia #4": "Series Superfan",
  "Television Trivia #5": "Stream It or Skip It",
  "Video Games Trivia #1": "Player One Ready",
  "Video Games Trivia #2": "Game Over: Quiz Edition",
  "Video Games Trivia #3": "Level Up Your Knowledge",
  "Video Games Trivia #4": "Final Boss Trivia",
  "Video Games Trivia #5": "Respawn & Retry",
  "Board Games Trivia #1": "Roll the Dice",
  "Board Games Trivia #2": "Tabletop Titans",
  "Board Games Trivia #3": "Game Night Champion",
  "Board Games Trivia #4": "Strategy & Luck",
  "Board Games Trivia #5": "The Board Room",
  "Science & Nature Trivia #1": "Lab Coat Required",
  "Science & Nature Trivia #2": "Nature's Secrets",
  "Science & Nature Trivia #3": "Atom Smasher",
  "Science & Nature Trivia #4": "Wild Science",
  "Science & Nature Trivia #5": "The Natural World",
  "Computers Trivia #1": "Debug Mode",
  "Computers Trivia #2": "Root Access",
  "Computers Trivia #3": "The Tech Stack",
  "Computers Trivia #4": "Binary Brain",
  "Computers Trivia #5": "Silicon Valley Smarts",
  "Mathematics Trivia #1": "Number Crunch",
  "Mathematics Trivia #2": "The Maths Workout",
  "Mathematics Trivia #3": "Pi Day Every Day",
  "Mathematics Trivia #4": "Proof by Quiz",
  "Mathematics Trivia #5": "Equation Station",
  "Mythology Trivia #1": "Gods & Monsters",
  "Mythology Trivia #2": "Ancient Legends",
  "Mythology Trivia #3": "Myth Busters: Trivia",
  "Mythology Trivia #4": "Tales of the Gods",
  "Mythology Trivia #5": "Heroes & Epics",
  "Sports Trivia #1": "Final Whistle",
  "Sports Trivia #2": "Gold Medal Round",
  "Sports Trivia #3": "Game Day IQ",
  "Sports Trivia #4": "The Sports Desk",
  "Sports Trivia #5": "Stadium Smarts",
  "Geography Trivia #1": "Around the World in 10 Questions",
  "Geography Trivia #2": "Capital Punishment (Quiz Edition)",
  "Geography Trivia #3": "Borders & Beyond",
  "Geography Trivia #4": "Map Masters",
  "Geography Trivia #5": "Landmark Legends",
  "History Trivia #1": "Through the Ages",
  "History Trivia #2": "Past Masters",
  "History Trivia #3": "History Repeats",
  "History Trivia #4": "The Timeline Challenge",
  "History Trivia #5": "Echoes of the Past",
  "Politics Trivia #1": "Power & Policy",
  "Politics Trivia #2": "The Ballot Box",
  "Politics Trivia #3": "West Wing Wannabe",
  "Politics Trivia #4": "Political Animals",
  "Politics Trivia #5": "The Summit",
  "Art Trivia #1": "Brush Strokes",
  "Art Trivia #2": "Gallery Walk",
  "Art Trivia #3": "Master Class",
  "Art Trivia #4": "The Art Vault",
  "Art Trivia #5": "Canvas & Chisel",
  "Animals Trivia #1": "Wild Kingdom",
  "Animals Trivia #2": "Safari Smarts",
  "Animals Trivia #3": "Planet Earth Quiz",
  "Animals Trivia #4": "Claws, Fins & Feathers",
  "Animals Trivia #5": "Animal Kingdom Unlocked",
  "Vehicles Trivia #1": "Rev It Up",
  "Vehicles Trivia #2": "Full Throttle Trivia",
  "Vehicles Trivia #3": "Miles Per Quiz",
  "Vehicles Trivia #4": "The Fast Lane",
  "Vehicles Trivia #5": "Pit Stop Quiz",
  "Comics Trivia #1": "Panel by Panel",
  "Comics Trivia #2": "Cape & Cowl",
  "Comics Trivia #3": "Secret Identity",
  "Comics Trivia #4": "The Splash Page",
  "Comics Trivia #5": "Origins & Arcs",
  "Anime & Manga Trivia #1": "Opening Credits",
  "Anime & Manga Trivia #2": "Arc by Arc",
  "Anime & Manga Trivia #3": "Power Level Check",
  "Anime & Manga Trivia #4": "The Weeb Test",
  "Anime & Manga Trivia #5": "Shonen Showdown",
  "Cartoons Trivia #1": "Saturday Morning Smarts",
  "Cartoons Trivia #2": "Toon Time",
  "Cartoons Trivia #3": "Animation Nation",
  "Cartoons Trivia #4": "Drawing Blanks",
  "Cartoons Trivia #5": "Cel Shaded Champion",
};

// ─── NEW ORIGINAL QUIZZES ─────────────────────────────────────────────────
const NEW_QUIZZES = [

  // ── MUSICALS & THEATRE (Morgan Lee) ───────────────────────────────────
  {
    title: "Stage Fright? Not Us!",
    category: "Musicals & Theatre",
    emoji: "🎭",
    color: "#10b981",
    creator_id: MORGAN,
    plays: rando(6, 30),
    questions: [
      { text: "Which city is Broadway located in?", answers: ["Chicago","Los Angeles","New York City","Las Vegas"], correct: 2, diff: "easy" },
      { text: "How many Tony Awards did Hamilton win at the 2016 ceremony?", answers: ["9","10","11","12"], correct: 2, diff: "medium" },
      { text: "Which musical features the song 'Memory'?", answers: ["Chicago","Phantom of the Opera","Cats","Les Misérables"], correct: 2, diff: "easy" },
      { text: "What Shakespeare play is West Side Story based on?", answers: ["Hamlet","A Midsummer Night's Dream","Romeo and Juliet","Othello"], correct: 2, diff: "easy" },
      { text: "In which country did the musical 'Mamma Mia!' premiere?", answers: ["USA","Australia","UK","Sweden"], correct: 2, diff: "medium" },
      { text: "What is the term for the area directly in front of and below the stage?", answers: ["Wings","Pit","Fly","Apron"], correct: 1, diff: "medium" },
      { text: "Which musical is set during the French Revolution?", answers: ["Hamilton","Les Misérables","Miss Saigon","Rent"], correct: 1, diff: "easy" },
      { text: "Who wrote the music for The Phantom of the Opera?", answers: ["Stephen Sondheim","Andrew Lloyd Webber","Lin-Manuel Miranda","Elton John"], correct: 1, diff: "easy" },
      { text: "What does 'SR' mean in stage directions?", answers: ["Stage Rear","Stage Right","Stage Rehearsal","Scene Reset"], correct: 1, diff: "medium" },
      { text: "Which musical tells the story of Alexander Hamilton?", answers: ["1776","Founding Fathers","Hamilton","In the Heights"], correct: 2, diff: "easy" },
    ],
  },
  {
    title: "Curtain Call Champions",
    category: "Musicals & Theatre",
    emoji: "🎭",
    color: "#10b981",
    creator_id: MORGAN,
    plays: rando(6, 30),
    questions: [
      { text: "Which Shakespeare theatre was reconstructed near its original London site in 1997?", answers: ["The Rose","The Fortune","The Globe","The Curtain"], correct: 2, diff: "medium" },
      { text: "Grease is set in which decade?", answers: ["1940s","1950s","1960s","1970s"], correct: 1, diff: "easy" },
      { text: "Which musical features the song 'Defying Gravity'?", answers: ["Wicked","Into the Woods","Enchanted","Rent"], correct: 0, diff: "easy" },
      { text: "What is a 'soliloquy'?", answers: ["A duet between two actors","A speech delivered alone on stage","A type of stage lighting","A musical overture"], correct: 1, diff: "medium" },
      { text: "The EGOT is achieved by winning Emmy, Grammy, Oscar, and which other award?", answers: ["BAFTA","Olivier","Tony","Golden Globe"], correct: 2, diff: "medium" },
      { text: "Which musical is based on the life of Eva Perón?", answers: ["Evita","Chicago","Cabaret","Gypsy"], correct: 0, diff: "easy" },
      { text: "In theatre, what does 'breaking the fourth wall' mean?", answers: ["Destroying a set piece","Addressing the audience directly","Exiting through the back","Improvising a line"], correct: 1, diff: "easy" },
      { text: "Which city is London's West End theatre district most associated with?", answers: ["Edinburgh","Manchester","London","Birmingham"], correct: 2, diff: "easy" },
      { text: "The musical Rent is loosely based on which opera?", answers: ["Carmen","Madama Butterfly","La Bohème","Rigoletto"], correct: 2, diff: "hard" },
      { text: "What is a 'matinee'?", answers: ["An evening performance","An afternoon performance","A dress rehearsal","An opening night show"], correct: 1, diff: "easy" },
    ],
  },

  // ── CELEBRITIES (Jamie Chen) ───────────────────────────────────────────
  {
    title: "Star Spotting",
    category: "Celebrities",
    emoji: "⭐",
    color: "#eab308",
    creator_id: JAMIE,
    plays: rando(10, 45),
    questions: [
      { text: "Which singer is known as the 'Queen of Pop'?", answers: ["Whitney Houston","Beyoncé","Madonna","Mariah Carey"], correct: 2, diff: "easy" },
      { text: "Dwayne Johnson's nickname is 'The ___'?", answers: ["Mountain","Rock","Wall","Stone"], correct: 1, diff: "easy" },
      { text: "Which celebrity founded the production company Flower Films?", answers: ["Cameron Diaz","Drew Barrymore","Reese Witherspoon","Jennifer Aniston"], correct: 1, diff: "hard" },
      { text: "Taylor Swift grew up in which US state?", answers: ["Tennessee","Pennsylvania","Texas","California"], correct: 1, diff: "medium" },
      { text: "Which actor plays Tony Stark / Iron Man in the MCU?", answers: ["Chris Evans","Mark Ruffalo","Robert Downey Jr.","Jeremy Renner"], correct: 2, diff: "easy" },
      { text: "Kim Kardashian became famous partly through a reality show called 'Keeping Up with the ___'?", answers: ["Joneses","Kardashians","Jenners","Stars"], correct: 1, diff: "easy" },
      { text: "Which celebrity chef is known for making cooking accessible with his 'Naked Chef' persona?", answers: ["Gordon Ramsay","Heston Blumenthal","Jamie Oliver","Nigella Lawson"], correct: 2, diff: "easy" },
      { text: "Elon Musk was born in which country?", answers: ["USA","Canada","South Africa","Australia"], correct: 2, diff: "medium" },
      { text: "Rihanna is from which Caribbean island?", answers: ["Jamaica","Trinidad","Barbados","Cuba"], correct: 2, diff: "medium" },
      { text: "Which celebrity couple was nicknamed 'Brangelina'?", answers: ["Brad Pitt & Jennifer Aniston","Brad Pitt & Angelina Jolie","Ben Affleck & Jennifer Lopez","Ryan Reynolds & Blake Lively"], correct: 1, diff: "easy" },
    ],
  },
  {
    title: "Famous Faces",
    category: "Celebrities",
    emoji: "⭐",
    color: "#eab308",
    creator_id: JAMIE,
    plays: rando(10, 45),
    questions: [
      { text: "Which pop star's real name is Stefani Joanne Angelina Germanotta?", answers: ["Katy Perry","Lady Gaga","Kesha","Lorde"], correct: 1, diff: "medium" },
      { text: "Oprah Winfrey was born in which US state?", answers: ["Illinois","Georgia","Mississippi","Tennessee"], correct: 2, diff: "hard" },
      { text: "Which actor has played both Jack Sparrow and Edward Scissorhands?", answers: ["Jim Carrey","Johnny Depp","Nicolas Cage","Bill Murray"], correct: 1, diff: "easy" },
      { text: "Cristiano Ronaldo is from which country?", answers: ["Spain","Brazil","Portugal","Argentina"], correct: 2, diff: "easy" },
      { text: "Which entrepreneur co-founded Apple with Steve Jobs?", answers: ["Bill Gates","Steve Wozniak","Paul Allen","Larry Ellison"], correct: 1, diff: "easy" },
      { text: "Jennifer Lopez is also known by what initials?", answers: ["JLo","JLope","JenniL","J-Lo"], correct: 0, diff: "easy" },
      { text: "Which musician's alter ego was 'Ziggy Stardust'?", answers: ["Freddie Mercury","Elton John","David Bowie","Mick Jagger"], correct: 2, diff: "medium" },
      { text: "Adele is from which city?", answers: ["Manchester","Liverpool","Birmingham","London"], correct: 3, diff: "medium" },
      { text: "Which celebrity authored the memoir 'Becoming'?", answers: ["Hillary Clinton","Malala Yousafzai","Michelle Obama","Oprah Winfrey"], correct: 2, diff: "medium" },
      { text: "Kylie Jenner founded which beauty brand?", answers: ["Fenty Beauty","Rare Beauty","Kylie Cosmetics","NARS"], correct: 2, diff: "easy" },
    ],
  },

  // ── GADGETS & TECH (Taylor Brooks) ────────────────────────────────────
  {
    title: "Gadget Guru",
    category: "Gadgets & Tech",
    emoji: "📱",
    color: "#0369a1",
    creator_id: TAYLOR,
    plays: rando(8, 35),
    questions: [
      { text: "What does 'OLED' stand for in display technology?", answers: ["Optical Light Emitting Device","Organic Light Emitting Diode","Over-Layer Electronic Display","Open Light Emission Design"], correct: 1, diff: "medium" },
      { text: "Which company makes the Galaxy smartphone series?", answers: ["Apple","Sony","Samsung","Huawei"], correct: 2, diff: "easy" },
      { text: "What technology allows phones to pay contactlessly in stores?", answers: ["Bluetooth","Wi-Fi","NFC","GPS"], correct: 2, diff: "easy" },
      { text: "What does 'SSD' stand for?", answers: ["Solid State Drive","Super Speed Disk","System Storage Device","Sequential Sync Drive"], correct: 0, diff: "easy" },
      { text: "AirPods are made by which company?", answers: ["Samsung","Sony","Bose","Apple"], correct: 3, diff: "easy" },
      { text: "Which smart home speaker is made by Amazon?", answers: ["Google Home","HomePod","Echo","Nest Hub"], correct: 2, diff: "easy" },
      { text: "What does 'RAM' stand for in computing?", answers: ["Random Access Memory","Read And Monitor","Rapid Application Mode","Real-time Access Module"], correct: 0, diff: "easy" },
      { text: "The Apple Watch runs which operating system?", answers: ["iOS","iPadOS","watchOS","macOS"], correct: 2, diff: "medium" },
      { text: "Which company makes the PlayStation gaming console?", answers: ["Microsoft","Nintendo","Sony","Sega"], correct: 2, diff: "easy" },
      { text: "What is the name of Tesla's self-driving technology feature?", answers: ["AutoDrive","Autopilot","SmartSteer","CruiseAI"], correct: 1, diff: "medium" },
    ],
  },
  {
    title: "Tech Specs & Specs",
    category: "Gadgets & Tech",
    emoji: "📱",
    color: "#0369a1",
    creator_id: TAYLOR,
    plays: rando(8, 35),
    questions: [
      { text: "What generation of wireless technology is '5G' named after?", answers: ["3rd","4th","5th","6th"], correct: 2, diff: "easy" },
      { text: "Which company invented the first commercially successful smartwatch?", answers: ["Apple","Samsung","Pebble","Sony"], correct: 2, diff: "hard" },
      { text: "USB-C is notable for being which of the following?", answers: ["Larger than USB-A","One-directional only","Reversible","Wireless only"], correct: 2, diff: "easy" },
      { text: "What is the maximum resolution called that is four times Full HD?", answers: ["2K","4K","8K","16K"], correct: 1, diff: "easy" },
      { text: "Google's mobile OS is called what?", answers: ["iOS","HarmonyOS","Android","Symbian"], correct: 2, diff: "easy" },
      { text: "Which tech giant owns the Pixel smartphone brand?", answers: ["Meta","Microsoft","Amazon","Google"], correct: 3, diff: "easy" },
      { text: "What does IoT stand for?", answers: ["Internet of Things","Integration of Technology","Input Output Terminal","Internal Operating Thread"], correct: 0, diff: "medium" },
      { text: "Which company makes the Surface range of laptops and tablets?", answers: ["Apple","Dell","Microsoft","HP"], correct: 2, diff: "easy" },
      { text: "What is the name for Apple's voice assistant?", answers: ["Alexa","Cortana","Bixby","Siri"], correct: 3, diff: "easy" },
      { text: "A 'drone' in tech is best described as what?", answers: ["An underground server","An unmanned aerial vehicle","A background software process","A type of battery"], correct: 1, diff: "easy" },
    ],
  },

  // ── SOCIAL MEDIA IQ (Jamie Chen) ─────────────────────────────────────
  {
    title: "Social Media IQ",
    category: "Pop Culture",
    emoji: "📲",
    color: "#ec4899",
    creator_id: JAMIE,
    plays: rando(15, 55),
    questions: [
      { text: "Which platform introduced the concept of 'Stories' that disappear after 24 hours?", answers: ["Twitter","Snapchat","Instagram","TikTok"], correct: 1, diff: "medium" },
      { text: "What does 'DM' stand for on social media?", answers: ["Direct Message","Digital Media","Daily Memo","Deleted Message"], correct: 0, diff: "easy" },
      { text: "Which platform is known for its algorithm-driven 'For You Page'?", answers: ["Instagram","YouTube","TikTok","Twitter"], correct: 2, diff: "easy" },
      { text: "What was Twitter rebranded to in 2023?", answers: ["T","Xitter","X","Twit"], correct: 2, diff: "easy" },
      { text: "What is the maximum length of a standard tweet (in characters)?", answers: ["140","240","280","320"], correct: 2, diff: "medium" },
      { text: "YouTube was acquired by which company in 2006?", answers: ["Meta","Amazon","Microsoft","Google"], correct: 3, diff: "medium" },
      { text: "What is a 'hashtag' used for on social media?", answers: ["Marking a post as private","Linking to an external website","Categorising content by topic","Tagging another user"], correct: 2, diff: "easy" },
      { text: "Which platform has a 'Retweet' feature?", answers: ["Instagram","Facebook","X (Twitter)","LinkedIn"], correct: 2, diff: "easy" },
      { text: "What does 'going viral' mean?", answers: ["A post gets deleted","Content spreads rapidly across the internet","A user gets banned","A platform crashes"], correct: 1, diff: "easy" },
      { text: "LinkedIn is primarily used for what purpose?", answers: ["Gaming","Professional networking","Video sharing","Dating"], correct: 1, diff: "easy" },
    ],
  },

  // ── CRYPTO & WEB3 BASICS (Taylor Brooks) ─────────────────────────────
  {
    title: "Crypto & Web3 Basics",
    category: "Technology",
    emoji: "🔗",
    color: "#f97316",
    creator_id: TAYLOR,
    plays: rando(8, 30),
    questions: [
      { text: "Bitcoin was created by the pseudonymous person or group known as?", answers: ["Elon Musk","Satoshi Nakamoto","Vitalik Buterin","Nick Szabo"], correct: 1, diff: "medium" },
      { text: "What does NFT stand for?", answers: ["New Financial Token","Non-Fungible Token","Network File Transfer","Next Finance Technology"], correct: 1, diff: "easy" },
      { text: "Ethereum's native currency is called?", answers: ["Bitcoin","Litecoin","Ether","Ripple"], correct: 2, diff: "medium" },
      { text: "A 'blockchain' is best described as?", answers: ["A type of social network","A distributed ledger of transactions","A cloud storage service","A programming language"], correct: 1, diff: "easy" },
      { text: "What is a 'crypto wallet' used for?", answers: ["Mining new coins","Storing physical cash","Storing and managing digital assets","Printing NFTs"], correct: 2, diff: "easy" },
      { text: "What does 'HODL' mean in crypto slang?", answers: ["Sell immediately","Hold on for dear life — keep your assets","Hack or disrupt a ledger","High output digital leverage"], correct: 1, diff: "medium" },
      { text: "Which process involves verifying transactions on a blockchain in exchange for rewards?", answers: ["Staking","Mining","Minting","Bridging"], correct: 1, diff: "medium" },
      { text: "What is a 'smart contract'?", answers: ["A legal document signed digitally","Self-executing code stored on a blockchain","A type of hardware wallet","An AI trading bot"], correct: 1, diff: "medium" },
      { text: "Bitcoin has a maximum supply cap of how many coins?", answers: ["10 million","18 million","21 million","100 million"], correct: 2, diff: "medium" },
      { text: "What is a 'rug pull' in crypto?", answers: ["A technical bug in a blockchain","When developers abandon a project after taking investors' funds","A type of market rally","A hardware wallet malfunction"], correct: 1, diff: "hard" },
    ],
  },

  // ── AUSTRALIAN GEOGRAPHY & CULTURE (Sam Okafor) ────────────────────
  {
    title: "G'Day Australia!",
    category: "Geography",
    emoji: "🦘",
    color: "#0891b2",
    creator_id: SAM,
    plays: rando(8, 35),
    questions: [
      { text: "What is the capital city of Australia?", answers: ["Sydney","Melbourne","Brisbane","Canberra"], correct: 3, diff: "easy" },
      { text: "Which Australian state is home to the Great Barrier Reef?", answers: ["New South Wales","Victoria","Queensland","Western Australia"], correct: 2, diff: "easy" },
      { text: "What is the name of the large rock formation in the Northern Territory sacred to Aboriginal Australians?", answers: ["Mount Kosciuszko","Uluru","Devils Marbles","The Olgas"], correct: 1, diff: "easy" },
      { text: "Australia's currency is the?", answers: ["Australian Pound","Australian Dollar","Aussie Franc","Pacific Dollar"], correct: 1, diff: "easy" },
      { text: "What does the Australian slang 'arvo' mean?", answers: ["Morning","Evening","Afternoon","Tomorrow"], correct: 2, diff: "medium" },
      { text: "Which city is Australia's most populous?", answers: ["Canberra","Melbourne","Brisbane","Sydney"], correct: 3, diff: "easy" },
      { text: "What is the name of the strait separating Australia from Tasmania?", answers: ["Cook Strait","Torres Strait","Bass Strait","Tasman Strait"], correct: 2, diff: "hard" },
      { text: "Australia is the world's ___ largest country by area?", answers: ["4th","5th","6th","7th"], correct: 2, diff: "medium" },
      { text: "Which Australian landmark was designed by Danish architect Jørn Utzon?", answers: ["Melbourne Cricket Ground","Sydney Harbour Bridge","Sydney Opera House","Parliament House"], correct: 2, diff: "easy" },
      { text: "What animal appears on the Australian coat of arms alongside the emu?", answers: ["Kangaroo","Koala","Wombat","Platypus"], correct: 0, diff: "easy" },
    ],
  },

  // ── FOOD & DRINK AROUND THE WORLD (Alex Rivera) ────────────────────
  {
    title: "Bon Appétit — Global Edition",
    category: "Food & Drink",
    emoji: "🍜",
    color: "#f59e0b",
    creator_id: ALEX,
    plays: rando(10, 45),
    questions: [
      { text: "Sushi originated in which country?", answers: ["China","Japan","Korea","Vietnam"], correct: 1, diff: "easy" },
      { text: "Which spice gives turmeric its distinctive yellow colour?", answers: ["Curcumin","Saffron","Paprika","Annatto"], correct: 0, diff: "hard" },
      { text: "Paella is a traditional dish from which country?", answers: ["Italy","Portugal","Spain","Greece"], correct: 2, diff: "easy" },
      { text: "What type of pasta is shaped like small rice grains?", answers: ["Penne","Fusilli","Orzo","Farfalle"], correct: 2, diff: "medium" },
      { text: "Croissants are most associated with which country?", answers: ["France","Belgium","Austria","Switzerland"], correct: 0, diff: "easy" },
      { text: "Which country is the largest producer of coffee in the world?", answers: ["Colombia","Ethiopia","Vietnam","Brazil"], correct: 3, diff: "medium" },
      { text: "Guacamole is made primarily from which fruit?", answers: ["Tomato","Avocado","Lime","Mango"], correct: 1, diff: "easy" },
      { text: "What is the main ingredient in hummus?", answers: ["Lentils","Black beans","Chickpeas","Edamame"], correct: 2, diff: "easy" },
      { text: "Which country invented the dish 'Pho'?", answers: ["Thailand","Vietnam","Cambodia","Laos"], correct: 1, diff: "medium" },
      { text: "What does 'al dente' mean when cooking pasta?", answers: ["Fully soft","With sauce","Firm to the bite","Well done"], correct: 2, diff: "easy" },
    ],
  },

  // ── SPACE EXPLORATION (Taylor Brooks) ────────────────────────────────
  {
    title: "To Infinity & Beyond",
    category: "Science & Nature",
    emoji: "🚀",
    color: "#22c55e",
    creator_id: TAYLOR,
    plays: rando(10, 40),
    questions: [
      { text: "Which planet in our solar system has the most moons?", answers: ["Jupiter","Saturn","Uranus","Neptune"], correct: 1, diff: "hard" },
      { text: "What is the name of NASA's most famous space telescope, launched in 1990?", answers: ["James Webb","Kepler","Spitzer","Hubble"], correct: 3, diff: "easy" },
      { text: "The first human to walk on the Moon was?", answers: ["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"], correct: 2, diff: "easy" },
      { text: "Elon Musk's private space company is called?", answers: ["Blue Origin","Virgin Galactic","SpaceX","Rocket Lab"], correct: 2, diff: "easy" },
      { text: "What is the closest star to our solar system?", answers: ["Sirius","Betelgeuse","Proxima Centauri","Vega"], correct: 2, diff: "medium" },
      { text: "What is a 'light-year' a measure of?", answers: ["Time","Speed","Distance","Brightness"], correct: 2, diff: "medium" },
      { text: "The International Space Station orbits Earth at approximately what altitude?", answers: ["100 km","200 km","400 km","800 km"], correct: 2, diff: "medium" },
      { text: "What is the name of Mars's largest volcano?", answers: ["Olympus Mons","Elysium Mons","Alba Mons","Pavonis Mons"], correct: 0, diff: "hard" },
      { text: "Which mission first landed humans on the Moon?", answers: ["Apollo 10","Apollo 11","Apollo 12","Gemini 8"], correct: 1, diff: "easy" },
      { text: "The James Webb Space Telescope primarily observes in which type of light?", answers: ["Ultraviolet","X-ray","Infrared","Visible"], correct: 2, diff: "hard" },
    ],
  },

];

// ─── INSERT QUIZ HELPER ───────────────────────────────────────────────────
async function insertQuiz(quiz) {
  const quizId = randomUUID();
  const { error: qErr } = await sb.from("quizzes").insert({
    id: quizId,
    title: quiz.title,
    category: quiz.category,
    emoji: quiz.emoji,
    color: quiz.color,
    creator_id: quiz.creator_id,
    is_public: true,
    plays: quiz.plays,
    created_at: randDate(),
  });
  if (qErr) { console.error(`  ❌ Quiz "${quiz.title}": ${qErr.message}`); return false; }

  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const qId = randomUUID();
    const timeLimit = q.diff === "hard" ? 30 : q.diff === "medium" ? 20 : 15;
    const points    = q.diff === "hard" ? 2000 : q.diff === "medium" ? 1000 : 500;

    const { error: queErr } = await sb.from("questions").insert({
      id: qId, quiz_id: quizId, text: q.text,
      time_limit: timeLimit, points, order_index: i,
    });
    if (queErr) { console.error(`    ❌ Q: ${queErr.message}`); continue; }

    const answers = q.answers.map((text, ai) => ({
      id: randomUUID(), question_id: qId, text, is_correct: ai === q.correct,
    }));
    const { error: aErr } = await sb.from("answers").insert(answers);
    if (aErr) console.error(`    ❌ A: ${aErr.message}`);
  }
  return true;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function run() {
  console.log("🎯 QuizWorld Original Content Writer\n");

  // Step 1: Rename generic titles
  console.log("📝 Renaming generic quiz titles...");
  let renamed = 0;
  const titles = Object.keys(RENAME_MAP);

  for (const oldTitle of titles) {
    const { error } = await sb.from("quizzes")
      .update({ title: RENAME_MAP[oldTitle] })
      .eq("title", oldTitle);
    if (error) {
      console.error(`  ❌ "${oldTitle}": ${error.message}`);
    } else {
      renamed++;
    }
  }
  console.log(`  ✅ ${renamed}/${titles.length} titles updated\n`);

  // Step 2: Insert new original quizzes
  console.log("🚀 Inserting original quizzes...");
  let inserted = 0;
  for (const quiz of NEW_QUIZZES) {
    const ok = await insertQuiz(quiz);
    if (ok) {
      inserted++;
      console.log(`  ✅ "${quiz.title}" (${quiz.category}) — ${quiz.questions.length}q`);
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`✅ Done!`);
  console.log(`   Titles renamed: ${renamed}`);
  console.log(`   New quizzes inserted: ${inserted}`);
  console.log(`══════════════════════════════════════\n`);
}

run().catch(console.error);
