# QuizWorld Production Handover

This handover package is based on the current repository at:

- `/Users/kevinmalana/Documents/quizworld`

It is intended for OpenClaw to deploy the production-ready Phoenix-backed QuizWorld `v12` stack.

## Deployment Target

Deploy this as a two-service application:

1. Next.js frontend
2. Phoenix realtime service

Supabase remains the persistent backend.

Redis is optional for single-node operation, but recommended for durability and future scale.

## What Is Included

The package includes:

- Next.js app under `app/`, `components/`, `lib/`, `public/`
- Phoenix service under `services/quizworld_realtime/`
- Supabase bootstrap and migrations under `supabase_setup.sql` and `supabase/migrations/`
- deployment and architecture docs
- production hardening changes merged on March 31, 2026

The package intentionally excludes:

- `node_modules/`
- `.next/`
- local environment files such as `.env.local`

## Production Intent

This handoff is configured for the Phoenix live-game path.

Do not deploy production with the legacy Supabase live-game engine.

Expected frontend env:

```bash
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=https://<phoenix-service-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<supabase-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
QUIZWORLD_AI_API_KEY=<ai-provider-key>
QUIZWORLD_AI_MODEL=<ai-model-name>
QUIZWORLD_AI_API_URL=https://<openai-compatible-endpoint>/v1/chat/completions
```

Expected Phoenix env:

```bash
PORT=4100
PHX_HOST=<phoenix-service-domain>
SECRET_KEY_BASE=<strong-random-secret>
ALLOWED_ORIGINS=https://<frontend-domain>,http://localhost:3000
SUPABASE_URL=https://<supabase-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
REDIS_URL=redis://<redis-host>:6379/0
```

## Required Database Work

For a fresh Supabase project:

1. Run `supabase_setup.sql`
2. Then run `supabase/migrations/20260331_v93_production_hardening.sql`
3. Then run `supabase/migrations/20260331_v94_quiz_drafts.sql`
4. Then run `supabase/migrations/20260331_v95_quiz_versioning.sql`
5. Then run `supabase/migrations/20260331_v96_quiz_archive.sql`

For an existing QuizWorld Supabase project:

1. Ensure `supabase/migrations/20260327_v92_game_results.sql` has been applied
2. Apply `supabase/migrations/20260331_v93_production_hardening.sql`
3. Apply `supabase/migrations/20260331_v94_quiz_drafts.sql`
4. Apply `supabase/migrations/20260331_v95_quiz_versioning.sql`
5. Apply `supabase/migrations/20260331_v96_quiz_archive.sql`

The `v93` migration is required. It closes public-read exposure on:

- private quiz questions
- private quiz answers
- legacy live session tables

The `v94` migration is required for the current quiz builder flow. It adds:

- account-backed quiz drafts
- draft questions
- draft answers
- RLS policies for draft ownership
- builder autosave support once users are signed in
- URL/document import flows in the create experience
- AI source-draft review flow in the create experience
- responsive/mobile-safe builder flow in the create experience

The `v95` migration is required for versioned republishing. It adds:

- `quiz_versions`
- initial version snapshots for new publishes
- `republish_quiz(...)` for updating an existing quiz while recording a new version
- dashboard-visible recent versions
- builder restore via `/create?version=<quiz_version_id>`

The `v96` migration is required for quiz lifecycle management. It adds:

- `archived_at` on `quizzes`
- dashboard archive/restore controls
- public query filtering for archived quizzes
- dashboard visibility toggles for public/private state

## Frontend Deployment

Deploy the root project as Next.js.

Important files:

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `app/`
- `components/`
- `lib/`

Build command:

```bash
npm install
npm run build
```

Start command:

```bash
npm start
```

## Phoenix Deployment

Deploy `services/quizworld_realtime/` as a separate Elixir service.

Important files:

- `services/quizworld_realtime/mix.exs`
- `services/quizworld_realtime/config/`
- `services/quizworld_realtime/lib/`

Build and boot:

```bash
cd services/quizworld_realtime
mix deps.get
mix compile
mix test
mix phx.server
```

The Phoenix service must be reachable from the frontend at `NEXT_PUBLIC_GAME_SERVICE_URL`.

## Critical Production Behavior

- Host session creation now requires a valid Supabase bearer token
- Phoenix derives host identity from verified auth, not client-supplied `host_id`
- Frontend will refuse to use the old live-game engine silently
- CORS is handled from runtime `ALLOWED_ORIGINS`
- Reconnect support is enabled for players
- Session tokens now expire

## Smoke Test Checklist

After deployment, verify:

1. Sign up and sign in work
2. Start a quiz in `/create`, pause, and confirm autosave creates or updates a remote draft
3. Use URL import in `/create` and confirm page text is fetched and can be converted into builder cards
4. Use document import in `/create` with a text-based file or pasted PDF text and confirm it converts into builder cards
5. Use AI Source Draft in `/create` and confirm it returns cited review cards when AI env vars are configured
6. On a phone-width viewport, confirm preview remains available from the builder
7. On a phone-width viewport, confirm timer and points can be edited from the in-flow Question Settings block
8. Generate an AI source draft from URL/document/paste text and confirm the draft keeps the correct source type after loading into the builder
9. Resume the saved draft from `/dashboard`
10. Create a quiz and publish it
11. Edit that quiz from `/dashboard` and republish it
12. Confirm republish returns to `/dashboard` with a version success notice
13. Restore a recent version into a draft from `/dashboard`
14. Archive and restore a quiz from `/dashboard`
15. Host a live game
16. Join from a second browser/device
17. Start game, answer, reveal, advance, finish
18. Refresh player browser mid-game and verify reconnect preserves identity
19. Confirm finished game appears in dashboard/profile hosted results
20. Confirm private quizzes are not readable through anonymous Supabase queries

## Known Remaining Constraint

The current workspace did not have Elixir installed, so Phoenix could not be compiled locally here before packaging. The Next.js build passed locally, but OpenClaw should run:

```bash
cd services/quizworld_realtime
mix deps.get
mix test
mix compile
```

before treating the deployment as final.

## Recommended Deploy Order

1. Apply Supabase SQL
2. Deploy Redis if using it
3. Deploy Phoenix service
4. Verify Phoenix `/api/health`
5. Deploy Next.js frontend
6. Run smoke test checklist
