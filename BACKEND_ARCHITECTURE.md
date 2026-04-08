# Historical Note

This file captures older backend planning and is not the authoritative source for the current deployed schema.
Use [docs/HANDBOOK.md](./docs/HANDBOOK.md) plus `supabase/migrations/` for the current implementation path.

# QuizWorld Backend Architecture

## Status of this document

This file describes the **target backend architecture**, not the current implementation.

Current implementation:

- no backend
- no auth
- no Supabase SDK in the codebase
- local browser persistence only via [`lib/store.ts`](./lib/store.ts)

If you are trying to understand the code that exists today, read:

- [`README.md`](./README.md)
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
- [`DEVELOPER_ONBOARDING.md`](./DEVELOPER_ONBOARDING.md)

## Current frontend data model

The current frontend already models the backend domain reasonably well:

- `Quiz`
- `Question`
- `Answer`
- `GameSession`
- `Player`
- `Profile`
- `StudyProgress`

These live in [`lib/store.ts`](./lib/store.ts) and should be treated as the starting point for the real backend schema.

## Why a backend is needed

The current localStorage-backed approach cannot support:

- cross-device multiplayer
- persistent accounts
- shared quiz libraries
- secure ownership and permissions
- real AI generation
- analytics across users

## Recommended target stack

### Core application backend

- `Supabase Postgres`
- `Supabase Auth`
- `Supabase Storage`

### Realtime layer

For early versions, either:

- `Supabase Realtime`

Or, if the product grows into heavier live gameplay:

- a dedicated realtime service later

### AI services

- server-side job flow for generation
- document upload + processing
- queued quiz generation and moderation

## Suggested backend phases

### Phase 1: shared persistence

Replace localStorage quiz/session persistence with real backend storage.

Build first:

- quiz CRUD
- profile persistence
- session creation lookup by PIN

### Phase 2: authentication

Add:

- user accounts
- ownership rules
- private vs public quiz rules

### Phase 3: realtime multiplayer

Replace local polling/local assumptions with:

- shared lobby state
- shared player join events
- shared question progression
- shared answer submission events

### Phase 4: AI generation

Replace the simulated AI flow with:

- generation request endpoint
- queued background processing
- generated draft quiz persistence
- review/publish flow

## Proposed data schema

### `users`

- `id`
- `email`
- `display_name`
- `avatar_url`
- `created_at`

### `profiles`

- `user_id`
- `total_plays`
- `total_correct`
- `best_score`
- `streak`
- `last_study_date`

### `quizzes`

- `id`
- `author_id`
- `title`
- `category`
- `emoji`
- `color`
- `is_public`
- `plays`
- `created_at`

### `questions`

- `id`
- `quiz_id`
- `text`
- `time_limit`
- `points`
- `order_index`

### `answers`

- `id`
- `question_id`
- `text`
- `is_correct`

### `game_sessions`

- `id`
- `pin`
- `quiz_id`
- `host_id`
- `status`
- `current_question_index`
- `created_at`

### `players`

- `id`
- `session_id`
- `nickname`
- `avatar`
- `score`
- `joined_at`

### `player_answers`

- `id`
- `player_id`
- `question_id`
- `answer_id`
- `is_correct`
- `response_time_ms`
- `points_awarded`

### `study_progress`

- `id`
- `user_id`
- `quiz_id`
- `questions_studied`
- `correct`
- `mastery`
- `last_studied`

## Mapping from current local store to backend

Current local keys:

- `qw_quizzes_v1`
- `qw_session_<PIN>`
- `qw_profile_v1`
- `qw_study_v1`

Migration direction:

- quizzes -> `quizzes`, `questions`, `answers`
- session objects -> `game_sessions`, `players`, `player_answers`
- profile object -> `profiles`
- study progress array -> `study_progress`

## Backend-first implementation priorities

1. Add environment and client wiring
2. Move quiz CRUD to the database
3. Move session lookup by PIN to the database
4. Add authenticated user ownership
5. Add realtime host/player sync
6. Replace simulated AI with server jobs

## What this doc should not imply

This doc should not be read as "already implemented".

It is the target architecture that should replace the current local-only prototype.
