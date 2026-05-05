# QuizWorld v12

QuizWorld v12 is a hybrid architecture:

- `Next.js + Supabase` for auth, quiz content, dashboard, study, and profile flows
- `Phoenix + Elixir + optional Redis` for authoritative live multiplayer sessions

## Current State

- The existing Next.js app remains in `app/` and still builds with `npm run build`.
- The new Phoenix game service lives in `services/quizworld_realtime/`.
- Supabase remains the system of record for users and quiz content.
- The Phoenix service is the live host/join/game runtime when `NEXT_PUBLIC_GAME_ENGINE=phoenix`.
- The quiz builder includes account-backed drafts, republish versioning, archive/visibility controls, URL/document import, and an AI source-draft review flow.
- The current builder layout is responsive: mobile/tablet users can preview quizzes, edit timers/points, and work through questions without the desktop-only right rail.
- Source-based AI drafts preserve their originating source type when loaded into the builder.
- Elixir tooling is not installed in this workspace, so the Phoenix service was scaffolded and documented but not compiled locally here.

## Repo Layout

- `app/`: Next.js routes
- `components/`: shared UI and auth provider
- `lib/supabase/`: Supabase browser client
- `lib/game-engine/`: frontend config/helpers for the new realtime engine
- `supabase/`: existing SQL schema and migrations
- `services/quizworld_realtime/`: Phoenix realtime game service
- `app/host`, `app/join`, `app/game/[pin]`: dual-engine frontend routes that use Phoenix when enabled

## Quick Start

Frontend:

```bash
npm install
npm run dev
```

Phoenix service:

```bash
cd services/quizworld_realtime
mix deps.get
mix phx.server
```

## Environment

Frontend `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=http://localhost:4100
QUIZWORLD_AI_API_KEY=...
QUIZWORLD_AI_MODEL=...
QUIZWORLD_AI_API_URL=https://<openai-compatible-endpoint>/v1/chat/completions
```

Phoenix service env:

```bash
PORT=4100
PHX_HOST=localhost
SECRET_KEY_BASE=replace-me
REDIS_URL=redis://localhost:6379/0
ALLOWED_ORIGINS=http://localhost:3000,https://www.quizworld.xyz
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Read This First

1. [docs/START_HERE.md](./docs/START_HERE.md)
2. [docs/V12_RELEASE.md](./docs/V12_RELEASE.md)
3. [docs/PHOENIX_V2_HANDOFF.md](./docs/PHOENIX_V2_HANDOFF.md)
4. [docs/V9_RELEASE.md](./docs/V9_RELEASE.md) (historical v9 rollout context)
5. [docs/V9_CONTRACT.md](./docs/V9_CONTRACT.md) (still useful for service-boundary reference)
6. [docs/HANDBOOK.md](./docs/HANDBOOK.md)
7. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
8. [docs/BUSINESS_DOCUMENTATION.md](./docs/BUSINESS_DOCUMENTATION.md)
9. [docs/USE_CASES.md](./docs/USE_CASES.md)
10. [docs/TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md)
11. [docs/STYLE_GUIDE.md](./docs/STYLE_GUIDE.md)
12. [docs/DEV_GUIDE.md](./docs/DEV_GUIDE.md)
13. [docs/TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)
14. [docs/BA_GUIDE.md](./docs/BA_GUIDE.md)
15. [docs/QUIZ_BUILDER_AGENT_HANDOVER.md](./docs/QUIZ_BUILDER_AGENT_HANDOVER.md)
16. [OPENCLAW_DEPLOY_HANDOVER.md](./OPENCLAW_DEPLOY_HANDOVER.md)
17. [services/quizworld_realtime/README.md](./services/quizworld_realtime/README.md)

## Deployment Shape

- Vercel: Next.js frontend
- Supabase: auth + quiz/study data
- Existing Supabase projects should apply:
  - `supabase/migrations/20260327_v92_game_results.sql`
  - `supabase/migrations/20260331_v93_production_hardening.sql`
  - `supabase/migrations/20260331_v94_quiz_drafts.sql`
  - `supabase/migrations/20260331_v95_quiz_versioning.sql`
  - `supabase/migrations/20260331_v96_quiz_archive.sql`
- Render/Fly.io/Railway or equivalent: Phoenix game service
- Redis OSS: optional session snapshot persistence and shared state support
