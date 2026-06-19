# QuizWorld

https://www.quizworld.xyz · `github.com/kevinmalana/quizworld`

---

## What it is

A live multiplayer quiz app. Host picks a quiz, gets a PIN, players join on their phones. Real-time questions and scoring. Like Kahoot but free.

Also has: quiz builder (manual, paste, AI-generated, PDF import), study mode (flashcard/quickfire), presentation mode, social features (friends/classrooms/groups/leaderboard/achievements).

---

## Architecture

```
Browser → Vercel (Next.js 16, static + SSR) → Supabase (Postgres, Auth)
         ↘ Render (Phoenix/Elixir) ──────────── WebSocket live game state
```

- **Frontend:** Next.js 16 on Vercel. All UI, auth, quiz builder, study, social pages.
- **Game engine:** Phoenix on Render (`quizworld-xs0g.onrender.com`). All real-time game state lives in GenServer memory. Results persisted to Supabase when a game finishes.
- **Database:** Supabase (`tqmygnkwkjtkteguemya.supabase.co`). Postgres + Auth + Storage + Realtime.

---

## Deploy

### Frontend (Vercel)
Deployed via CLI, not GitHub auto-deploy:

```bash
cd /root/.openclaw/workspace/quizworld
npm run build             # must pass
source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz
```

### Game Engine (Render)
Auto-deploys from GitHub `main` → `services/quizworld_realtime/`. Root Directory must be set in Render dashboard.

### Database (Supabase)
Schema changes are run manually in the Supabase SQL Editor. Baseline in `supabase_setup.sql`, migrations in `supabase/migrations/`.

---

## Secrets

| File | Contents |
|------|----------|
| `/root/.openclaw/secrets/deployment.env` | `VERCEL_TOKEN` |
| `/root/.openclaw/secrets/gh_token.txt` | GitHub PAT |
| `/root/.openclaw/workspace/quizworld/.env.local` | Supabase keys, AI keys, Phoenix URL |

---

## Key decisions / gotchas

### Phoenix PIN format
6-char alphanumeric from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. ~17% chance of being all-alpha. The join page routes all-alpha PINs to presentation mode unless the PIN came from a URL param (QR scan).

### Game modes
- **classic** — standard, everyone answers every question
- **survival** — wrong answer = eliminated. Ends when `alive_count < 2`.
- **team** — players auto-assigned to 2-4 teams round-robin on start

### Study page bug (fixed Jun 5)
Was querying by `.eq("id", quizId)` but `quizId` was a slug after the UUID→slug redirect. Now detects UUID vs slug.

### Slug URLs (Jun 5)
`quizzes.slug` column. Trigger auto-generates on INSERT. UUID params 301 redirect to slug.

### Dead snapshot
`/root/.openclaw/workspace/quizworld_v12_push` — ignore it, never deploy from it.

---

## Running tests

```bash
npx playwright test              # all E2E against production
npx playwright test e2e/security.spec.ts  # security tests only
```