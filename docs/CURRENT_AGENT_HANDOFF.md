# QuizWorld Current Agent Handoff

**Last updated:** 2026-06-05
**Production:** https://www.quizworld.xyz
**Repo:** https://github.com/kevinmalana/quizworld (branch: `main`)
**Workspace:** `/root/.openclaw/workspace/quizworld_v12_push/quizworld` ← current working copy
**Dead snapshot (DO NOT USE):** `/root/.openclaw/workspace/quizworld` (older)

---

## Quick Start

1. Read this file fully before touching anything.
2. All work goes in `/root/.openclaw/workspace/quizworld` on `main`.
3. Deploy frontend: `source /root/.openclaw/secrets/deployment.env && vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz`
4. Deploy Phoenix: push to GitHub → Render auto-deploys from `services/quizworld_realtime/` (Root Directory set in Render dashboard).
5. Run `npm run build` locally before deploying — never deploy a broken build.

---

## Stack

| Layer | Tech | URL / Location |
|---|---|---|
| Frontend | Next.js 15 on Vercel | www.quizworld.xyz |
| Game Engine | Phoenix (Elixir) on Render | quizworld-xs0g.onrender.com |
| Database/Auth | Supabase | tqmygnkwkjtkteguemya.supabase.co |
| Cache | Redis (on Render) | — |

---

## Secrets & Credentials

| File | Contains |
|---|---|
| `/root/.openclaw/secrets/deployment.env` | `VERCEL_TOKEN` |
| `/root/.openclaw/secrets/gh_token.txt` | GitHub personal access token |
| `/root/.openclaw/workspace/quizworld/.env.local` | All env vars (Supabase, AI keys, Phoenix URL) |

**Deploy commands:**
```bash
# Push to GitHub
GH_TOKEN=$(cat /root/.openclaw/secrets/gh_token.txt | tr -d '\n')
git push "https://x-access-token:${GH_TOKEN}@github.com/kevinmalana/quizworld.git" main

# Deploy frontend to Vercel
source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz
```

---

## Architecture: Game Engine (Phoenix)

**CRITICAL — read before touching game code:**

- All game state lives **in-memory** in Phoenix GenServer processes (not Supabase).
- Game results are persisted to Supabase via `ResultSync.persist_finished_game/1` when game finishes.
- Phoenix PIN format: **6-character alphanumeric** from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (~17% chance all-alpha).
- The `/join` page handles this: if `initialPin` came from URL param (QR scan), skip presentation routing check entirely.

**Game flow:**
```
Host: /host → select quiz + mode → Launch → /game/[pin] (waiting)
Player: /join?pin=XXXX → nickname → /game/[pin] (waiting)
Host: Start → active → (auto-reveal on timer) → reveal → advance → ... → finished
```

**State broadcast:**
- Every state change (join, start, answer, reveal, advance) broadcasts `{:session_updated, snapshot}` via PubSub to all connected clients.
- Both `GameServer.reply_with_transition` (REST) AND `GameChannel.transition/3` (WebSocket) broadcast.
- Frontend subscribes via `subscribeToPhoenixTopic` (WebSocket) AND polls via `loadSession` on reconnect.
- Staleness guard in `applySessionSnapshot`: drops snapshots with older `updated_at` than current state.

**Game modes:**
- `classic` — standard, all players answer every question
- `survival` — wrong answer = eliminated; `alive_count < 2` ends game (1 remaining = winner)
  - Minimum 2 players to start (lobby blocks start otherwise)
  - `everyoneAnswered` uses `aliveCount` not `players.length` (eliminated can't answer)
  - Host "Answered X/Y" denominator uses `aliveCount` in survival
  - Timer hidden for eliminated players
  - Eliminated list shown at reveal phase
- `team` — players auto-assigned to 2-4 teams by round-robin on game start

**Render deployment:**
- Service: `quizworld-xs0g.onrender.com`
- Root Directory in Render dashboard: `services/quizworld_realtime` ← **MUST be set or build fails**
- Auto-deploys on push to GitHub `main`
- Health check: `GET /api/health` → `{"status":"ok","service":"quizworld_realtime","redis":true}`

---

## Architecture: Frontend (Next.js)

**Key patterns:**
- Auth: Supabase Auth via `useAuth()` hook from `components/supabase-provider.tsx`
- All pages that need auth: destructure `const { user, loading: authLoading } = useAuth()` and gate on `authLoading` before showing UI or redirecting.
- Protected pages redirect to `/login` when `!user && !authLoading` and set `sessionStorage.setItem("qw_post_login_redirect", path)` first.
- Google OAuth: passes `?next=` param in `redirectTo` so callback route redirects correctly post-auth.

**Categories:**
- Valid categories defined in `lib/store.ts` → `CATEGORY_COLORS` and `CATEGORY_EMOJIS`
- `General Knowledge` IS a valid category (added 2026-05-31)
- DB has **no** category CHECK constraint — `CATEGORY_COLORS` in `lib/store.ts` is the source of truth (40+ categories)

**Catalog queries:**
- No `.limit()` on quiz catalog fetches in explore, host, study pages — full catalog always fetched
- Explore search uses live DB `ilike` query (300ms debounce) — NOT client-side filter of loaded page
- Study sessions query also has no limit

**AI features:**
- Quiz generation: `POST /api/ai-source-draft` — uses Groq `llama-3.3-70b-versatile`
- Game insights: `POST /api/ai-game-insights` — dedicated route, returns bullet-point insights aware of game mode
- Model set via `QUIZWORLD_AI_MODEL` env var (Vercel + `.env.local`)

---

## Join/Routing Rules

| PIN type | Where it goes |
|---|---|
| URL param (`/join?pin=XXXX`) | Always game — skip presentation check |
| Typed manually, all-alpha | `/present/join` (presentation) |
| Typed manually, has digits | `/join` → game |
| Homepage enter | Always `/join` — no routing guess |

**Why:** ~17% of Phoenix PINs are all-alpha. Homepage previously misdirected these to presentation join.

---

## Report & AI Insights

- **Report page** (`/report/[pin]`): host-only (checks `host_id === user.id`)
- **3 tabs:** Overview (stats + mode-specific summary + podium), By Question (answer distribution, difficulty, quality score), Players (ranked list with accuracy)
- **Export CSV:** includes answer text (not answer ID)
- **AI Insights:** calls `/api/ai-game-insights` with full game context including mode, eliminated list, team scores. Returns 4 bullet-point insights. Rendered as separate `<p>` tags.

---

## Known Issues / Pending Work

### Security
- Private quiz RLS: anon users can still read `is_public=false` quizzes (pre-existing issue, add RLS policy)
- `game_results` readable by anon (pre-existing issue)

### Not Built Yet
- Contact page (`/contact`)
- Profile image upload (emoji picker only)
- `support@quizworld.xyz` email (needs Cloudflare Email Routing)
- Collections (explore) — hardcoded UI only
- Push notifications for friend requests / classroom joins
- Live AUD/INR exchange rate (ISRO autopilot)

---

## Smoke Test Checklist (run after any major deploy)

```
[ ] Homepage loads, Enter Game → /join
[ ] /explore loads quizzes, search finds quizzes
[ ] /explore — clicking Study on a quiz loads the study page correctly (no "quiz not found")
[ ] /quiz/<slug> loads quiz detail page with correct title/metadata (e.g. /quiz/ancient-rome)
[ ] /quiz/<uuid> redirects 301 → /quiz/<slug>
[ ] /study/<slug> loads study page correctly
[ ] /study/<uuid> redirects 301 → /study/<slug>
[ ] /explore/history loads category page with quizzes
[ ] /aws-practice-test loads landing page
[ ] /kahoot-alternative loads landing page
[ ] /create → AI from topic, question count picker shows 5/10/20/30/50/65
[ ] /create → AI generates 65 questions when 65 selected
[ ] /host → select quiz, select survival mode, launch button shows 💀
[ ] QR scan → /join?pin=XXXX stays on join page (NOT presentation)
[ ] Join game → enter nickname → /game/[pin] lobby shows mode pill
[ ] Start survival with 2 players → wrong answer → eliminated screen shows after reveal
[ ] /report/[pin] → host only, AI Insights shows bullet points
[ ] Google OAuth → redirects back to originating page
[ ] View source of /quiz/<slug> — confirm title tag contains quiz name (not "Loading...")
```

---

## Migrations Applied (cumulative, 2026-05-31)

In addition to all prior migrations, apply:
1. `supabase/migrations/20260531_v96_category_enforcement.sql` — category constraint + normalise_category()

All other migrations from `supabase_setup.sql` baseline + `v92` through `v95` must be applied first (see `OPENCLAW_DEPLOY_HANDOVER.md`).

---

## Latest Significant Changes (2026-06-05)

### SEO Overhaul
- **Slug URLs:** `quizzes` table now has a `slug` column. All 160 existing quizzes have slugs generated (e.g. `ancient-rome`, `premier-league-2024`). New quizzes auto-get a slug via Postgres trigger.
- **UUID → slug redirect:** `/quiz/[id]` and `/study/[id]` detect UUID params and 301 redirect to slug URL. Both routes also accept slugs directly.
- **Dynamic metadata:** `generateMetadata` on `/quiz/[id]` and `/study/[id]` — each quiz page has unique title, description, canonical URL based on actual quiz title/category/question count.
- **JSON-LD structured data:** Quiz schema markup on every `/quiz/[id]` page for Google rich results.
- **Dynamic OG images:** `/api/og` edge route generates per-quiz gradient OG card (title, emoji, category, question count). Used in OpenGraph metadata for quiz pages.
- **Category landing pages:** `/explore/[category]` — 20 server-rendered category pages (e.g. `/explore/science-and-nature`, `/explore/history`). Each has SEO-optimised metadata and quiz grid.
- **High-traffic landing pages:** `/aws-practice-test` and `/kahoot-alternative` — dedicated SEO pages targeting high-volume search terms.
- **`/quiz` landing page:** Top quizzes grid, rankable for "free online quizzes".
- **Sitemap updated:** Now includes `/quiz`, `/explore/{category}` × 20, `/aws-practice-test`, `/kahoot-alternative`, plus `lastmod` dates on all quiz pages.
- **Homepage description:** Keyword-rich (Kahoot alternative, AWS, certification, classroom, trivia, join by PIN). Title kept as "Live Quizzes That Feel Like Game Night".
- **ISR caching:** `export const revalidate = 3600` on `/quiz/[id]` and `/study/[id]` — pages cached at Vercel edge for 1 hour.

### AI Question Count Expanded
- AI quiz generator now supports **5 / 10 / 20 / 30 / 50 / 65** questions (was 3/5/8/10).
- 65Q added specifically for AWS/cert exam packs (AWS exams have exactly 65 questions).
- Server-side cap raised from `Math.min(10,...)` to `Math.min(65,...)`.
- Default changed from 5 → 10.
- `AIQuestionCount` type and `QuestionCountPicker` component both updated in `components/builder/CreateSourceModals.tsx`.

### Bug Fixes
- **Study page "quiz not found":** `StudyPageClient` was fetching by `.eq("id", quizId)` but after UUID→slug redirect, `quizId` was a slug string. Fixed: now detects UUID vs slug and queries accordingly.
- **Explore card links:** Now use `quiz.slug || quiz.id` for all `/quiz/` and `/study/` links — no redirect round-trip.
- **`slug` field added to `Quiz` interface** in `lib/store.ts`.
- **`@dnd-kit` deps installed** — was missing from remote, blocking builds.

### DB Changes (apply in Supabase SQL editor)
- Migration: `supabase/migrations/20260605_quiz_slugs.sql`
  - Adds `slug TEXT` column to `quizzes`
  - Unique partial index on slug
  - Backfills slugs for all existing quizzes
  - Trigger: `quiz_slug_trigger` — auto-generates slug on INSERT
- **Status:** ✅ Applied to production (verified: `SELECT COUNT(*) FROM quizzes WHERE slug IS NULL` = 0)

### Pending / Not Built
- AWS practice exam quizzes (CLF-C02, SAA-C03, DVA-C02) — seeder script at `scripts/seed-aws-quizzes.js`, needs `SUPABASE_SERVICE_ROLE_KEY` to run
- Contact page
- Profile image upload
- `support@quizworld.xyz` email
- Collections (explore) — hardcoded UI only

---

## Latest Significant Changes (2026-05-31)

See `AUDIT_REPORT.md` for the full bug list. Key architectural changes:

- Phoenix `game_channel.ex` `transition/3` now broadcasts to PubSub (was host-only reply)
- Phoenix `game_server.ex` `reply_with_transition` now broadcasts to PubSub (was caller-only reply)
- Survival: `alive_count < 2` ends game (was `<= 1`, ended too early)
- Join page: `initialPin` guard prevents QR pins routing to presentation
- New API route: `app/api/ai-game-insights/route.ts`
- `lib/store.ts`: `General Knowledge` added to `CATEGORY_COLORS` / `CATEGORY_EMOJIS`
