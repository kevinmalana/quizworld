# QuizWorld Latest Handoff — 2026-05-07

This ZIP contains the latest QuizWorld source deployed to `https://www.quizworld.xyz`, including the Join PIN UI hotfix.

## What is included

- **Next.js 16 frontend**: quiz builder, dashboard, explore, study, host/join/game pages.
- **Phoenix realtime engine**: Elixir/Phoenix live game session service.
- **Supabase schema + SQL**: tables, RLS policies, RPCs, storage bucket policies.
- **Docs**: architecture, schema, setup, deployment, and testing notes.
- **E2E tests**: Playwright smoke/regression tests.

## What is intentionally excluded

- `node_modules/`
- `.next/`
- Elixir `deps/` and `_build/`
- `.git/`
- `.env`, `.env.local`, `.env.vercel`, `.vercel/`
- Playwright reports/test output
- Supabase CLI temp files

No production secrets are included.

---

## System architecture

```text
Browser / Players / Host
        │
        ▼
Next.js app on Vercel
- App Router pages
- Supabase Auth session handling
- Quiz builder/dashboard/explore/study UI
- AI draft API routes
- Host/join frontend screens
        │
        ├──────────────► Supabase
        │                - Postgres data store
        │                - Auth
        │                - Row Level Security
        │                - RPCs for publish/update/results
        │                - quiz-images storage bucket
        │
        └──────────────► Phoenix realtime engine on Render
                         - REST session endpoints
                         - WebSocket game events
                         - GenServer in-memory game state
                         - Optional Redis snapshots
                         - Writes finished results back to Supabase
```

### Next.js responsibilities

- Public marketing/home pages.
- Quiz creation/editing UI in `app/create` and `components/builder`.
- Auth-gated creator dashboard in `app/dashboard`.
- Public discovery and study flows.
- Player join flow in `app/join`.
- Game screen in `app/game/[pin]`.
- AI generation endpoints:
  - `app/api/ai-source-draft/route.ts`
  - `app/api/import-url/route.ts`

### Phoenix responsibilities

Phoenix is the live game engine. It handles state that changes too fast for normal database-only UX:

- Creates game sessions and PINs.
- Tracks host/player connection state.
- Stores active game state in memory via GenServers.
- Accepts player joins and answers.
- Controls start/reveal/advance/finish events.
- Optionally snapshots state to Redis.
- Calls Supabase `record_game_result(...)` when a game finishes.

Key files:

- `lib/quizworld_realtime/game.ex`
- `lib/quizworld_realtime/game_server.ex`
- `lib/quizworld_realtime/games.ex`
- `lib/quizworld_realtime/result_sync.ex`
- `lib/quizworld_realtime/state_store.ex`
- `lib/quizworld_realtime_web/controllers/session_controller.ex`
- `lib/quizworld_realtime_web/channels/game_channel.ex`
- `lib/quizworld_realtime_web/live/game_live/show.ex`

### Supabase responsibilities

Supabase is the persistent system of record:

- Users/profiles via Supabase Auth.
- Quizzes, questions, answers.
- Draft quizzes and draft question/answer trees.
- Quiz version snapshots.
- Game sessions metadata.
- Final game results.
- Public image storage for quiz/answer images.

---

## Supabase SQL to run

Use the combined SQL file in this ZIP:

```text
supabase/APPLY_SUPABASE_COMPLETE_2026-05-07.sql
```

Run it in:

```text
Supabase Dashboard → SQL Editor → New Query → paste file contents → Run
```

This combined file includes:

1. Main tables.
2. RLS enablement.
3. RLS policies.
4. `publish_quiz(...)` RPC.
5. `republish_quiz(...)` RPC.
6. `record_game_result(...)` RPC for Phoenix.
7. Image columns.
8. `quiz-images` storage bucket and storage policies.
9. Updated image-aware publish/republish RPCs.

After running, verify:

```sql
select proname
from pg_proc
where proname in ('publish_quiz', 'republish_quiz', 'record_game_result')
order by proname;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('questions', 'answers', 'quiz_draft_questions', 'quiz_draft_answers')
  and column_name = 'image_url';

select id, public, file_size_limit
from storage.buckets
where id = 'quiz-images';
```

Expected:

- 3 RPC names returned.
- `image_url` present on all four question/answer tables.
- `quiz-images` bucket exists and is public.

---

## Required environment variables

### Next.js / Vercel

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=https://YOUR_RENDER_PHOENIX_URL

QUIZWORLD_AI_API_KEY=YOUR_GROQ_KEY
QUIZWORLD_AI_MODEL=llama-3.1-8b-instant
QUIZWORLD_AI_API_URL=https://api.groq.com/openai/v1/chat/completions
```

### Phoenix / Render

```bash
PHX_HOST=YOUR_RENDER_HOSTNAME
PORT=4000
SECRET_KEY_BASE=GENERATED_SECRET
ALLOWED_ORIGINS=https://www.quizworld.xyz,https://quizworld.xyz
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
REDIS_URL=rediss://...   # optional but recommended
```

Generate Phoenix secret:

```bash
mix phx.gen.secret
```

---

## Supabase Auth settings

Set these in Supabase:

```text
Authentication → URL Configuration
```

- Site URL: `https://www.quizworld.xyz`
- Redirect URLs:
  - `https://www.quizworld.xyz/login`
  - `https://quizworld.xyz/login`
  - local dev URL if needed: `http://localhost:3000/login`

---

## Latest verified state

- Latest production deploy: `2026-05-07`.
- Site: `https://www.quizworld.xyz`.
- Join PIN UI clipping fixed.
- Local build passed: `npm run build`.
- Targeted Playwright regression passed after PIN fix.
- Prior full Playwright suite: `39/39` passing.

## Known remaining ops items

1. Apply/confirm Supabase SQL in production.
2. Confirm Supabase Auth redirect settings.
3. Confirm Render Phoenix env vars.
4. Add Redis/Upstash for Phoenix snapshots if not already connected.
