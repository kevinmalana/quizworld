# Architecture

## v10 System Map

```text
Next.js UI
  -> Supabase Auth + Postgres
  -> Phoenix Realtime Service
       -> Phoenix Channels
       -> in-memory game processes
       -> optional Redis snapshot persistence
```

## Responsibilities

### Next.js

- render public/product pages
- sign users in via Supabase
- create and manage quizzes
- run the builder workflow:
  - drafts
  - republish/version restore
  - archive/visibility controls
  - URL/document import
  - AI source-draft review
- show dashboard, study, and profile data
- connect to the game engine configured in `lib/game-engine/config.ts`

### Supabase

- user identities
- quiz metadata and authored questions
- public explore library
- study progress and profile data

### Phoenix

- session creation
- player joins
- answer locking
- timer enforcement
- reveal and scoring
- channel broadcasts to all connected clients
- optional LiveView-rendered game screens

### Redis

- optional persistence of session snapshots
- optional cross-node state support for future horizontal scale

## Current Service Scaffold

The new runtime lives in:

- `services/quizworld_realtime/mix.exs`
- `services/quizworld_realtime/lib/quizworld_realtime/games.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/game_server.ex`
- `services/quizworld_realtime/lib/quizworld_realtime_web/channels/game_channel.ex`

## Builder And Content Ingestion

The builder currently spans:

- `app/create/page.tsx`
- `app/dashboard/page.tsx`
- `lib/quiz-drafts.ts`
- `lib/quiz-import.ts`
- `lib/quiz-ai.ts`
- `app/api/import-url/route.ts`
- `app/api/ai-source-draft/route.ts`

The important design point is that AI generation is a review step, not a publish shortcut.
Generated questions are reviewed in the frontend first, then loaded into the normal builder flow.

## Migration Direction

1. Keep content/auth in Supabase.
2. Move live host/join/game flows to Phoenix.
3. Keep study/dashboard/profile in Next.js + Supabase.
4. Add Redis only where shared session durability or fan-out pressure justifies it.
