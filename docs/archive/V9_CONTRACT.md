# V9 Contract

## Purpose

This document defines the non-negotiable runtime contract for `QuizWorld v9`.

The goal is to stop the architecture drifting back into mixed ownership, where browser code, Supabase, and the live game runtime all try to control the same game state.

## Core Rule

There are two backend domains:

- `Supabase` owns persistent product data
- `Phoenix` owns live multiplayer runtime state

They must not both act as the authority for the same concern at the same time.

## Ownership Boundaries

### Supabase Owns

- users and auth-backed profiles
- quizzes
- questions
- answers
- study progress
- post-game analytics and saved results
- dashboard/profile reporting data

### Phoenix Owns

- live session creation
- live session status
- player join state
- player presence within a session
- countdown/timer enforcement
- answer locking
- reveal and scoring
- leaderboard progression
- host-only control transitions
- optional LiveView rendering for live game surfaces

### Redis Owns

- optional ephemeral snapshot persistence
- optional presence/rate-limit support
- optional multi-node support

Redis does not own authored quiz data or user accounts.

## Forbidden Patterns

These are not allowed in `v9`:

- frontend/browser scoring
- frontend/browser authority over round progression
- Supabase tables acting as the primary live runtime state machine
- duplicate game authority in both Supabase and Phoenix
- storing authored quiz content primarily in Redis
- direct player identity based only on public client-provided ids

## Frontend Contract

The Next.js frontend is responsible for:

- authenticating the host with Supabase
- loading quiz content from Supabase
- creating a live session in Phoenix
- joining a live session through Phoenix
- rendering host/player/spectator UI
- showing persisted study/dashboard/profile data from Supabase

The frontend is not allowed to:

- calculate authoritative round scores
- decide whether the answer window is still open
- directly mutate live session state outside Phoenix

## Session Creation Contract

When a host starts a live game:

1. Next.js loads the selected quiz from Supabase.
2. Next.js sends Phoenix:
   - `pin`
   - `host_id`
   - `quiz_id`
   - normalized `questions`
   - optional mode/config metadata
3. Phoenix creates the authoritative game session.
4. After creation, live state comes from Phoenix only.

## Join Contract

When a player joins:

1. The player enters a PIN in Next.js.
2. Next.js resolves the live session from Phoenix.
3. Phoenix creates the player inside the session.
4. Phoenix returns a private player token/session credential.
5. The browser stores that token client-side for that session only.

Player answer submission must require that private credential.

## Live Game State Machine

The canonical round flow is:

`waiting -> active -> reveal -> finished`

### `waiting`

- players may join
- host may start
- no answers accepted

### `active`

- current question is open
- timer is running
- players may submit one answer
- Phoenix enforces answer window closure

### `reveal`

- answers are closed
- Phoenix computes correctness and points
- leaderboard is updated
- host may advance

### `finished`

- no more answers accepted
- final leaderboard is frozen
- results become eligible for write-back to Supabase

## Host Authority Contract

Only the host may trigger:

- start
- reveal
- advance
- finish

Host identity must be checked by Phoenix, not inferred only from the browser UI.

## Result Sync Contract

At the end of a game, Phoenix should write a summary back to Supabase.

Recommended persisted result data:

- `quiz_id`
- `host_id`
- final player scores
- player count
- finished timestamp
- total plays increment

In this repo, the write-back entrypoint is `public.record_game_result(...)`.

Supabase should use this saved result data for:

- profile stats
- dashboard stats
- quiz play counts
- future analytics/reporting

## Read/Write Rules

### During a live game

- frontend reads live state from Phoenix
- frontend writes live actions to Phoenix
- Supabase is read-only for quiz content needed by the frontend

### After a live game

- Phoenix writes summarized results to Supabase
- frontend reads reporting/stats from Supabase

## Deployment Contract

### Vercel

- deploys the Next.js frontend only

### Supabase

- auth
- persistent product data
- reporting/study/profile data

### Phoenix Host

- live multiplayer runtime
- channels/API for session actions

### Redis

- optional support service for Phoenix

## Cutover Rule

If `NEXT_PUBLIC_GAME_ENGINE=phoenix`, then:

- `/host`
- `/join`
- `/game/[pin]`

must treat Phoenix as the live authority.

They must not fall back to mutating Supabase live session state in parallel.

## Transitional Rule

During migration, it is acceptable for:

- create/dashboard/explore/study/profile to stay on Supabase
- host/join/game to move first to Phoenix

It is not acceptable for a single live game session to be partially controlled by Supabase and partially by Phoenix.

## Implementation Priority

1. Define stable Phoenix session/action payloads.
2. Make host/join/game fully authoritative through Phoenix.
3. Add Phoenix channel-based updates after REST parity exists.
4. Add end-of-game write-back to Supabase.
5. Add Redis-backed durability/presence only after single-node behavior is correct.

## Acceptance Criteria

`v9` is behaving correctly when:

- unsigned users cannot become live hosts
- players cannot spoof another player’s answer
- browser clients cannot award arbitrary points
- timers are enforced by Phoenix
- host controls are authoritative
- a finished game writes summarized results back to Supabase
- docs and code agree on the live authority model
