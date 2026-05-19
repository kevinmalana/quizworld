# V9 Operator Handoff

## Goal

Deploy `QuizWorld v9` as a hybrid system:

- Next.js frontend on Vercel
- Supabase for auth/content/reporting
- Phoenix realtime service on a VPS or Elixir-capable host

## Deploy Order

1. Apply the Supabase SQL
2. Deploy the Phoenix service
3. Deploy the Next.js frontend
4. Run the smoke test

## 1. Supabase

For an existing project, apply:

- `supabase/migrations/20260327_v92_game_results.sql`

This adds:

- `public.game_results`
- `public.record_game_result(...)`

Supabase remains responsible for:

- auth
- quizzes/questions/answers
- study progress
- saved game result summaries

## 2. Phoenix Service

Deploy from:

- `services/quizworld_realtime/`

Required env:

```bash
PORT=4100
PHX_HOST=game.quizworld.xyz
SECRET_KEY_BASE=replace-me
ALLOWED_ORIGINS=https://www.quizworld.xyz
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optional env:

```bash
REDIS_URL=redis://localhost:6379/0
```

Run shape:

```bash
cd services/quizworld_realtime
mix deps.get
mix test
mix phx.server
```

Production recommendation:

- run Phoenix behind Nginx or Caddy
- expose it on a dedicated subdomain such as `game.quizworld.xyz`

Health check:

- `GET /api/health`

## 3. Vercel Frontend

Deploy the root Next.js app.

Required Vercel env:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=https://game.quizworld.xyz
```

Recommended Vercel settings:

- Framework: `Next.js`
- Install command: `npm install`
- Build command: `npm run build`

## 4. Smoke Test

1. Sign in on the frontend.
2. Create or select a quiz.
3. Host a game.
4. Join from a second browser/device.
5. Start the game as host.
6. Submit answers as the player.
7. Let at least one round expire without the host clicking reveal and confirm Phoenix auto-reveals.
8. Confirm reveal and leaderboard update live.
9. Finish the game.
10. Confirm a row is written to `public.game_results`.

## Quick Verification SQL

```sql
select pin, quiz_id, host_id, player_count, finished_at
from public.game_results
order by finished_at desc
limit 10;
```

## Important Rule

If `NEXT_PUBLIC_GAME_ENGINE=phoenix`, then live host/join/game authority must come from Phoenix, not Supabase.

## Current Phoenix Runtime Notes

- Phoenix currently enforces `classic` mode only.
- The server now generates Phoenix-hosted session PINs and player ids.
- Host control actions now require a private host token, not a public host id.
