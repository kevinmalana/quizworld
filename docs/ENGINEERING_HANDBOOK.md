# Architecture Reference

## Database (Supabase)

### Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `quizzes` | Quiz catalog (public) | SELECT: public. INSERT/UPDATE/DELETE: authenticated creator |
| `questions` | Quiz questions | SELECT: public. Write: authenticated creator |
| `answers` | Answer choices per question | SELECT: public |
| `profiles` | User profiles | SELECT: public. Write: owner only |
| `game_sessions` | Live/historical game sessions | SELECT: anon (game page needs it). Write: host only |
| `players` | Players in a game session | SELECT: host. Write: via `join_game_session` RPC (SECURITY DEFINER) |
| `player_answers` | Submitted answers | Write: via `submit_player_answer` RPC. SELECT: host |
| `user_achievements` | Per-user achievements | SELECT: owner only (`auth.uid() = user_id`). INSERT: owner only |
| `achievements` | Achievement catalog | SELECT: public |

### Key RPCs

| RPC | Access | Purpose |
|-----|--------|---------|
| `join_game_session(session_id, nickname, avatar)` | anon | Joins a game, returns `player_token` |
| `submit_player_answer(player_id, player_token, question_id, answer_id, time_taken)` | anon | Submit answer during game |
| `lookup_game_by_pin(p_pin)` | anon | Look up game metadata by PIN (replaces direct table read) |

### Security fixes applied (2026-06-19)

- `import-pdf` API now requires Supabase auth (was: anyone could upload with arbitrary userId)
- `user_achievements` RLS enabled, old permissive policies dropped
- `lookup_game_by_pin` RPC created — join page uses this instead of direct `game_sessions` read

---

## Game Engine (Phoenix)

### Live game state

All game state lives in Phoenix GenServer memory. Nothing in Supabase until game ends.

State broadcasts: every change (join, start, answer, reveal, advance) broadcasts `{:session_updated, snapshot}` via PubSub to all connected clients. Both REST (`GameServer.reply_with_transition`) and WebSocket (`GameChannel.transition/3`) broadcast.

Frontend subscribes via `subscribeToPhoenixTopic` (WebSocket) and polls via `loadSession` on reconnect.

Staleness guard: `applySessionSnapshot` drops snapshots with older `updated_at` than current state.

### Survival mode specifics

- `aliveCount` (not `players.length`) for answer tracking denominator
- Timer hidden for eliminated players
- Eliminated list shown at reveal
- Minimum 2 players to start

---

## Frontend (Next.js 16)

### Auth

Supabase Auth via `useAuth()` hook from `components/supabase-provider.tsx`. Pattern:

```
const { user, loading: authLoading } = useAuth();
if (authLoading) return <Loading />;
if (!user) redirect to /login;
```

Google OAuth passes `?next=` in `redirectTo`.

### AI features

- Quiz generation: `POST /api/ai-source-draft` → Groq `llama-3.3-70b-versatile`
- Supports 5/10/20/30/50/65 questions (65 for AWS exam packs)
- Game insights: `POST /api/ai-game-insights`

### Categories

Source of truth: `CATEGORY_COLORS` / `CATEGORY_EMOJIS` in `lib/store.ts`. No DB CHECK constraint.

---

## Schema migrations

- Baseline: `supabase_setup.sql`
- Additional: `supabase/migrations/`
- Slugs: `supabase/migrations/20260605_quiz_slugs.sql`

## E2E tests

```
e2e/
  quizworld.spec.ts      — core pages, builder, study, explore, mobile
  security.spec.ts       — import-pdf auth, RLS, join RPC, auth guards, headers
  error-handling.spec.ts — error states for game, dashboard, study, join
  game-flow-complete.spec.ts — lobby, question, answer, reveal, finished
  game-engine.spec.ts    — Phoenix integration, mode-specific panels
  store-integration.spec.ts — Zustand store across pages
  ... plus achievements, classrooms, leaderboard, presentation, study
```