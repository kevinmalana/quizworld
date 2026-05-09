# Architecture

## Current System Map

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


## Current Frontend Component Structure

Routes should remain thin containers. UI should live in component folders:

- `/create` uses `components/builder/BuilderWorkspace.tsx`, `CreateSourceModals.tsx`, `PublishLoginPrompt.tsx`, and existing question editor components.
- `/game/[pin]` uses `components/game/live-game-panels.tsx` plus helpers in `lib/game/`.
- `/study` uses `components/study/study-dashboard.tsx` and `study-quiz-card.tsx`.
- `/study/[id]` uses `components/study/study-session-panels.tsx` and `lib/study/types.ts`.
- `/dashboard` uses `components/dashboard/dashboard-cards.tsx` and shared metric/status primitives.
- `/explore` uses `components/explore/explore-quiz-card.tsx` and `components/shared/share-study-link-button.tsx`.

Route-specific CSS is split into `styles/builder.css`, `styles/game.css`, `styles/present.css`, and `styles/study.css`. Avoid reintroducing runtime style injection or large inline style blocks.

## Current Verification Contract

Use `npm run check` as the local release gate. It runs TypeScript, Next.js production build, Phoenix compile with warnings-as-errors, and Phoenix tests. Use `BASE_URL=https://www.quizworld.xyz npx playwright test --project=chromium` for production regression after deploy.
