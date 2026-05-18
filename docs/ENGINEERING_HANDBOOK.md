# QuizWorld Engineering Handbook

**Last updated:** 2026-05-18  
**Production:** https://www.quizworld.xyz  
**Repo:** https://github.com/kevinmalana/quizworld  
**Workspace:** `/root/.openclaw/workspace/quizworld`

---

## Architecture Overview

QuizWorld is a **split-runtime application** with three live services:

```
Browser
  │
  ├─▶ Vercel (Next.js 16 + React 19)     ← UI, auth, quiz builder, study, social
  │     └─▶ Supabase (Postgres + Auth)   ← all persistent data
  │
  └─▶ Render (Phoenix/Elixir)            ← live game WebSocket sessions
```

### Service URLs

| Service | URL | Purpose |
|---|---|---|
| Frontend | `www.quizworld.xyz` | Next.js App Router |
| Phoenix | `quizworld-xs0g.onrender.com` | Live game engine (WebSocket) |
| Supabase | `tqmygnkwkjtkteguemya.supabase.co` | Auth + DB |

---

## Repository Layout

```
app/                          Next.js App Router pages
  (auth)/                     Login, signup
  admin/                      Admin dashboard (server-side auth guard via middleware)
  achievements/               Achievement gallery page
  api/                        API routes (AI, import, webhooks)
  classrooms/                 Classroom list + [id] detail
  create/                     Quiz builder (SourcePicker → BuilderWorkspace)
  dashboard/                  User's quiz management
  explore/                    Public quiz catalog (paginated, 24/page)
  friends/                    Friends list, pending requests, friends leaderboard
  game/[pin]/                 Live game player/host UI
  groups/                     Trivia groups list + [id] detail
  host/                       Launch a live game session
  join/                       Join a game by PIN
  leaderboard/                Global leaderboard (all-time + weekly)
  present/                    Presentation mode
  profile/                    User profile (level, stats, quick actions)
  report/[pin]/               Post-game results (auth required)
  study/                      Study hall (quiz list + XP dashboard)
  study/[id]/                 Study session (flashcard / quickfire)
  u/[username]/               Public profile pages

components/
  builder/                    Quiz builder UI (source picker, question card, preview)
  dashboard/                  Dashboard stat cards
  explore/                    Explore quiz card
  game/                       Live game panels
  present/                    Presentation live/edit panels
  shared/                     Reusable: QR, host icon, share button
  social/
    social-primitives.tsx     ← Shared social UI components (use this)
  study/
    study-dashboard.tsx       XP progress, streak, sparkline
    study-session-panels.tsx  Flashcard, QuickFire, Review, Result panels
    study-quiz-card.tsx       Study hall quiz cards
  navigation.tsx              Main nav (desktop + mobile)

lib/
  achievements.ts             Achievement auto-unlock logic
  builder/                    Question factory, conversion helpers
  game/                       Game analytics, audio, session helpers
  game-engine/                Phoenix WebSocket client
  quiz-ai.ts                  AI draft validation + prompts
  rate-limit.ts               Auth-required + per-user sliding window rate limiter
  store.ts                    Category constants, shared types
  study/types.ts              Study mode types
  supabase/                   Browser + server Supabase clients

services/quizworld_realtime/  Phoenix/Elixir source (live game engine only)

styles/
  builder.css                 Quiz builder styles
  classrooms.css              Classroom page styles
  dashboard.css               Dashboard + explore styles
  friends.css                 Friends page styles (reserved)
  game.css                    Live game styles
  groups.css                  Groups page styles
  leaderboard.css             Leaderboard + podium styles
  present.css                 Presentation styles
  social.css                  ← Shared social layer styles (use this)
  study.css                   Study hall + session styles
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles — username, avatar, total_xp, study_streak, longest_streak |
| `quizzes` | Quiz metadata — title, category, creator_id, plays, is_public |
| `questions` | Quiz questions with type, time_limit, points, explanation |
| `answers` | Answer options with is_correct flag |
| `quiz_drafts` | Auto-saved drafts (owner RLS) |
| `quiz_versions` | Quiz version history |
| `game_results` | Post-game summaries |
| `game_sessions` | Live Phoenix session records |
| `study_progress` | Per-user per-quiz mastery score |
| `study_sessions` | XP history rows (sparkline source) |

### Social Tables

| Table | Purpose |
|---|---|
| `friendships` | `requester_id`, `addressee_id`, `status` (pending/accepted/declined) |
| `classrooms` | Classrooms with `join_code`, `created_by` |
| `classroom_members` | `classroom_id`, `user_id`, `role` (teacher/student) |
| `classroom_assignments` | Quizzes assigned to classrooms with optional `due_date` |
| `assignment_completions` | Student mark-complete records |
| `trivia_groups` | Groups with `join_code`, `is_public`, `emoji` |
| `trivia_group_members` | `group_id`, `user_id`, `role` (admin/member) |
| `group_pinned_quizzes` | Quizzes pinned to groups |
| `achievements` | Achievement definitions (slug, name, icon, xp_reward) |
| `user_achievements` | Per-user earned achievements |

### Views

| View | Purpose |
|---|---|
| `leaderboard_weekly` | Profiles joined with this-week study_sessions XP |

### RLS Notes

**Critical:** The `classrooms` ↔ `classroom_members` and `trivia_groups` ↔ `trivia_group_members` tables have a known infinite recursion risk if policies cross-reference each other. They use `SECURITY DEFINER` helper functions to break the loop:

```sql
is_classroom_member(classroom_id, user_id) → boolean
is_classroom_teacher(classroom_id, user_id) → boolean
is_group_member(group_id, user_id) → boolean
```

Never add cross-table references directly to RLS policies on these tables.

---

## XP & Level System

### XP Sources

| Action | XP |
|---|---|
| Flashcard correct answer | +25 |
| QuickFire correct answer | +45 |
| Complete any study session | +50 |
| Perfect score (100%) | +100 bonus |
| Achievement unlock | varies (50–1000) |

### Level Formula

```ts
function calcLevel(totalXp: number) {
  let level = 1, xpNeeded = 200;
  while (totalXp >= xpNeeded) { level++; xpNeeded += level * 200; }
  // Level n requires n*(n+1)*100 cumulative XP
}
```

Level 1 = 0 XP. Level 2 = 200 XP. Level 3 = 600 XP. Scales quadratically.

### Level Titles (30 defined)

Curious Learner (1) → Quiz Starter (2) → Knowledge Seeker (3) → Trivia Enthusiast (4) → Quiz Apprentice (5) → Study Scout (6) → Brain Trainer (7) → Quiz Adept (8) → Knowledge Builder (9) → Trivia Tactician (10) → ... → Master Learner (15) → Quiz Legend (20) → Grand Scholar (25) → Trivia Grandmaster (30+)

Defined in: `components/study/study-session-panels.tsx` → `LEVEL_TITLES`, `getLevelTitle()`, `calcLevel()`

---

## Achievement System

Achievements are defined in the `achievements` DB table (seeded). Auto-unlock logic is in `lib/achievements.ts` → `checkAndGrantAchievements()`.

Called from:
- `app/study/[id]/page.tsx` after each study session completes
- `app/friends/page.tsx` when accepting a friend request
- `app/classrooms/page.tsx` when joining a classroom
- `app/groups/page.tsx` when joining a group

The function is **idempotent** — safe to call multiple times, uses `UNIQUE(user_id, achievement_slug)` to prevent duplicates.

---

## AI Quiz Generation

Flow: `/create` → `SourcePicker` → `CreateSourceModals` → `/api/ai-source-draft`

Config (Vercel env vars):
- `QUIZWORLD_AI_API_KEY` — provider API key
- `QUIZWORLD_AI_API_URL` — provider base URL (defaults to Groq)
- `QUIZWORLD_AI_MODEL` — model name

Rate limiting: `lib/rate-limit.ts` — requires authentication (401 if not signed in), then per-user 15 req/min sliding window.

---

## Live Game Engine (Phoenix)

The Phoenix backend handles WebSocket game sessions. The Next.js frontend connects via `lib/game-engine/`.

Key env vars:
- `NEXT_PUBLIC_GAME_SERVICE_URL` — Phoenix base URL (set in Vercel dashboard, encrypted)
- `NEXT_PUBLIC_GAME_ENGINE` — engine type flag

Health check: `GET https://quizworld-xs0g.onrender.com/api/health` → `{"status":"ok","redis":true}`

---

## Component Conventions

### Social Pages

All social pages (`/friends`, `/classrooms`, `/groups`, `/leaderboard`, `/achievements`, `/u/[username]`) share:

1. **CSS** — `styles/social.css` (base primitives) + page-specific CSS file
2. **Components** — `components/social/social-primitives.tsx`:
   - `MemberRow` — avatar + name + level badge + streak + actions
   - `LeaderboardRow` — ranked row with podium styling
   - `LevelBadge` — `⭐ Lv N · Title`
   - `RoleBadge` — teacher/student/admin/member
   - `SocialCard` — generic card with emoji/title/desc/meta/actions
   - `JoinCode` — monospace code with copy button
   - `SocialEmpty` — empty state
   - `SocialLoading` — loading state
   - `StatusMsg` — success/error banner
   - `SocialPageHeader` — page title + subtitle

### Study Pages

Study session state lives entirely in `app/study/[id]/page.tsx`. Panels are pure display components in `components/study/study-session-panels.tsx`.

The `calcLevel()` and `getLevelTitle()` functions are exported from `study-session-panels.tsx` and used across the codebase — **do not duplicate them**.

---

## Quality Gates

Run before every commit:

```bash
npm run typecheck   # TypeScript — must be clean
npm run quality     # inline styles ≤218, any count ≤43, route file limits
npm run check       # full: typecheck + build + Phoenix tests
```

E2E tests:
```bash
BASE_URL=https://www.quizworld.xyz npx playwright test --project=chromium
# 83 tests, all must pass
```

---

## Deployment

```bash
# Push to GitHub (Vercel auto-deploys from main)
GH_TOKEN=$(tr -d '\n' < /root/.openclaw/secrets/gh_token.txt)
git push "https://x-access-token:${GH_TOKEN}@github.com/kevinmalana/quizworld.git" HEAD:main

# Manual Vercel deploy
source /root/.openclaw/secrets/deployment.env
cd /root/.openclaw/workspace/quizworld
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz

# Verify
curl -I https://www.quizworld.xyz
curl -s https://quizworld-xs0g.onrender.com/api/health
```

---

## Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| In-memory rate limiter resets on cold start | Medium | Works per-instance. For multi-region, swap `lib/rate-limit.ts` for `@upstash/ratelimit` |
| `study_progress` upsert needs unique constraint | Medium | Verify `(user_id, quiz_id)` unique constraint exists in Supabase |
| Group admin cannot remove members | Low | `handleRemoveMember` only exists in classrooms, not groups |
| No notification system | Low | Friend accepts, classroom joins etc. have no push notifications |
| Phoenix backup/restore | Low | No automated backup of live game session data |

---

## Seed Accounts

10 seed accounts exist for content seeding. All passwords: `QuizWorld2026!`

| Username | Email | XP | Level |
|---|---|---|---|
| sammyD | sportsfan_sam@quizworld.xyz | 1850 | 6 |
| patrickj | popculture_pat@quizworld.xyz | 1420 | 5 |
| mia_w | movie_mia@quizworld.xyz | 1180 | 5 |
| timbo_quiz | trivia_tim@quizworld.xyz | 950 | 4 |
| tony_v | techquiz_tony@quizworld.xyz | 780 | 4 |
| maxbeats | music_max@quizworld.xyz | 640 | 3 |
| gina_r | geoquiz_gina@quizworld.xyz | 520 | 3 |
| sarah_k | sciencesarah@quizworld.xyz | 390 | 2 |
| hank_m | historyhenry@quizworld.xyz | 280 | 2 |
| fran_eats | foodie_fran@quizworld.xyz | 200 | 2 |

Seeding script: `scripts/seed-users-and-quizzes.mjs`
