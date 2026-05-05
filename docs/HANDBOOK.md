# Handbook

## Overview

QuizWorld `v9` splits responsibilities cleanly:

- `Next.js` handles UI, auth-aware screens, quiz authoring, study, and profile
- `Supabase` stores users, quizzes, questions, answers, and study data
- `Phoenix` owns live session runtime, scoring, and channel fan-out
- `Redis` is optional backing storage for Phoenix session snapshots

Phoenix can now also render a dedicated game surface through LiveView for the live game layer, without replacing the rest of the Next.js site.

The binding rulebook for these boundaries is [V9_CONTRACT.md](./V9_CONTRACT.md).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Content/Auth | Supabase Auth + Postgres |
| Live Runtime | Phoenix, Elixir, Phoenix Channels |
| Realtime Cache | Redis OSS |
| Deployment | Vercel + dedicated Phoenix host |

## Main Folders

| Path | Purpose |
|---|---|
| `app/` | Next.js routes |
| `lib/supabase/` | Supabase client wiring |
| `lib/game-engine/` | Frontend config for Supabase vs Phoenix game runtime |
| `supabase/` | Existing schema and migrations |
| `services/quizworld_realtime/` | Phoenix realtime service |

## Runtime Ownership

| Concern | Owner |
|---|---|
| Sign in / sign up | Supabase |
| Quiz CRUD | Supabase |
| Study progress | Supabase |
| Finished game results | Supabase |
| Host game session | Phoenix |
| Join game | Phoenix |
| Answer submission | Phoenix |
| Reveal / score / next question | Phoenix |

## Key Constraint

The Phoenix service was added in code and docs, but it was not compiled in this workspace because Elixir tooling is not installed here.

## Current Frontend Integration

The `v9` frontend currently uses:

- REST endpoints for session create/join/start/answer/reveal/advance
- Phoenix Channels for live session updates
- polling as a fallback refresh path if the socket is unavailable
- Phoenix writes finished game summaries back to Supabase through `record_game_result`

## Documentation Set

The canonical `v9` handoff docs are:

- `START_HERE.md`
- `ARCHITECTURE.md`
- `BUSINESS_DOCUMENTATION.md`
- `USE_CASES.md`
- `TECHNICAL_DOCUMENTATION.md`
- `STYLE_GUIDE.md`
- `DEV_GUIDE.md`
- `TESTING_GUIDE.md`
- `BA_GUIDE.md`
- `services/quizworld_realtime/README.md`
