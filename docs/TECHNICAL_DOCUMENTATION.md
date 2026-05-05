# Technical Documentation

## Technical Summary

QuizWorld `v10` is a hybrid system with explicit service boundaries:

- `Next.js` renders the product UI
- `Supabase` stores durable product data
- `Phoenix` runs live multiplayer sessions
- `Redis` is optional support storage for Phoenix

## Runtime Ownership

### Next.js

- landing pages
- auth-facing screens
- quiz creation and library flows
- builder draft/version/archive/import/AI-review flows
- dashboard, study, and profile
- frontend runtime selection via `lib/game-engine/`

### Supabase

- auth users and profiles
- quizzes, questions, answers
- quiz drafts and version snapshots
- study progress
- durable game results

### Phoenix

- session create/join
- server-generated PIN creation
- server-generated player identity and player token issuance
- answer locking
- question timer enforcement
- auto-reveal on timer expiry
- reveal and round scoring
- session broadcasts
- optional LiveView game surface

## Main Code Areas

- `app/`: Next.js App Router pages
- `components/`: shared product UI and auth helpers
- `lib/game-engine/`: Phoenix/Supabase runtime helpers for the frontend
- `lib/quiz-drafts.ts`: draft/version mapping helpers
- `lib/quiz-import.ts`: structured import parsing and HTML text extraction
- `lib/quiz-ai.ts`: AI prompt/validation/conversion helpers
- `lib/reporting/`: result reporting helpers
- `supabase/`: SQL migrations and setup
- `services/quizworld_realtime/`: Phoenix runtime

## Phoenix Service Notes

Important Phoenix files:

- `services/quizworld_realtime/lib/quizworld_realtime/game.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/game_server.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/games.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/result_sync.ex`
- `services/quizworld_realtime/lib/quizworld_realtime_web/channels/game_channel.ex`
- `services/quizworld_realtime/lib/quizworld_realtime_web/live/game_live/show.ex`

## Data Flow

### Content Flow

- frontend reads and writes quiz content through Supabase
- Phoenix does not own authored quiz content

### Builder Source Flow

- structured text can be imported directly in the builder
- URL imports are fetched through `/api/import-url`
- document imports accept pasted PDF text and text-based file uploads
- AI source drafting runs through `/api/ai-source-draft`
- AI output is reviewed in the frontend before it becomes normal builder data

### Live Game Flow

- frontend creates/joins sessions through Phoenix
- Phoenix holds authoritative session state in-process
- Phoenix broadcasts updates through channels and can render a LiveView game room
- when the game finishes, Phoenix records summary results to Supabase

## Key Constraints

- do not restore client-authoritative scoring
- do not let Supabase and Phoenix both act as live-game authority
- do not move authored quiz content into Redis
- use Supabase for durable reporting, not live-round mutation

## Current Validation Status

- the Next.js app builds in this workspace
- the Next.js runtime was smoke-tested locally for builder import/AI validation endpoints
- Phoenix code is present and documented
- Phoenix now includes initial `ExUnit` tests under `services/quizworld_realtime/test/`
- Phoenix runtime still requires validation in an Elixir-capable environment
