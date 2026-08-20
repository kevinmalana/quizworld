# QuizWorld

QuizWorld is a multiplayer quiz platform. Hosts launch quizzes and control live rounds; players join from phones with a six-character PIN. The product also includes authoring, AI-assisted imports, solo study, interactive presentations, classrooms, groups and public profiles.

**Production:** https://www.quizworld.xyz

## Start here

A new developer should read these sources in order:

1. **This README** — setup, verification, repository map and contribution workflow.
2. [`CONTEXT.md`](CONTEXT.md) — product language, runtime ownership and live-game invariants.
3. [`docs/adr/`](docs/adr/) — decisions that should not be reversed casually.
4. [`services/quizworld_realtime/README.md`](services/quizworld_realtime/README.md) — Phoenix-specific setup and runtime details.

Those are the authoritative documents. Git history preserves old handoffs, audits and release notes; do not recreate them as active documents.

## System map

```text
Browser
  ├─ Vercel / Next.js       website, auth UI, authoring, study and social features
  ├─ Render / Phoenix       live-game state, timers, scoring and WebSockets
  └─ Supabase               Postgres, authentication, storage and durable results
                             ↕
                           Redis
                     Phoenix recovery snapshots
```

Runtime ownership is strict:

- **Next.js** requests commands and renders state; it does not own multiplayer rules.
- **Phoenix** is authoritative for active games, credentials, timing, scoring and phase transitions.
- **Redis** stores recoverable Phoenix snapshots.
- **Supabase** owns durable product data and authentication.

## Requirements

- Node.js 20+
- npm
- Elixir 1.17 and Erlang/OTP 27 for Phoenix work
- Redis when testing restart recovery end to end

## Local setup

### Frontend

```bash
cp .env.example .env.local
npm ci
npm run dev
```

### Realtime backend

```bash
cp .env.phoenix.example .env.phoenix
${EDITOR:-vi} .env.phoenix
set -a
source .env.phoenix
set +a
cd services/quizworld_realtime
mix deps.get
mix phx.server
```

The example files are the configuration reference; Phoenix reads the exported process environment and does not load `.env.phoenix` itself. Never commit credentials. Production values live in Vercel, Render and Supabase credential stores.

## Day-one verification

Run the complete deterministic gate:

```bash
npm run check
```

It runs:

1. the repository quality guard
2. TypeScript checking
3. TypeScript unit tests
4. the Next.js production build
5. Phoenix formatting, warnings-as-errors compilation and ExUnit tests

Browser tests are separate:

```bash
npm run test:e2e
```

`playwright.config.ts` defaults to `https://www.quizworld.xyz`. Use `BASE_URL` for a candidate build:

```bash
BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Some browser tests still depend on deployed services and authenticated fixtures. Do not treat a skipped full-flow test as proof that the journey works. Pull requests run deterministic code, unit, build and Phoenix checks; the production-coupled browser suite runs after a push to `main`. Run focused browser tests against a candidate `BASE_URL` before merging user-facing changes.

## Development workflow

1. Start from clean, current `main`.
2. Create a focused branch: `fix/...`, `feat/...`, `refactor/...` or `docs/...`.
3. Add behavioural tests at the module interface before changing behaviour.
4. Run targeted tests while working and `npm run check` before commit.
5. Request an independent review for multi-file changes.
6. Open a pull request. Merge to `main` only when production deployment is intended.

Vercel's Git integration deploys `main` automatically. Render deploys the Phoenix root declared in `render.yaml`. GitHub Actions verifies code; it is not a second Vercel deployment path.

## Live-game modules

The live-game browser interface is intentionally split by responsibility:

- `lib/game-engine/client.ts` — Phoenix HTTP commands
- `lib/game-engine/phoenix-socket.ts` — low-level channel connection and reconnect policy
- `lib/game/use-phoenix-game-channel.ts` — subscription state and disconnected fallback polling
- `lib/game/session-normalizers.ts` — snapshot normalization and revision checks
- `lib/game/game-analytics.ts` — derived leaderboard and achievement calculations
- `lib/shared.ts` — canonical category colour and emoji mappings
- `components/game/` — rendering modules
- `app/game/[pin]/page.tsx` — route orchestration

The backend interface is:

- `Games` — public game operations and store-based restoration
- `GameServer` — one commit/publication point per PIN
- `Game` — game rules and snapshots
- `GameStore` — recovery-store seam
- `StateStore` — Redis adapter used in production

Every accepted transition must be committed and published once. Do not add publication to controllers, channels or callers.

## Authentication and user data

Frontend auth comes from `useAuth()` in `components/supabase-provider.tsx`. Always wait for its loading state before deciding whether a user is signed in.

Protected browser actions must preserve the intended return path when redirecting to login. Anonymous data access should use a narrow RPC that exposes only the required fields instead of direct table access.

Phoenix validates Supabase bearer tokens for host creation. Host and player credentials are server-issued. Never trust an identity, score, response time or ownership claim only because a browser supplied it.

Before changing SQL or RLS:

1. inspect the actual production schema
2. verify table and column names
3. create a uniquely versioned migration
4. regenerate database types when available
5. test anonymous and authenticated access explicitly

`supabase_setup.sql` and aggregate SQL bundles are historical references, not production migration instructions. Never paste an old bundle into production.

## AI source generation

Quiz generation uses `POST /api/ai-source-draft`. Provider URL, model and API key come from environment variables documented in `.env.example`; do not hard-code provider configuration in the route.

Supported generated question counts are **5, 10, 20, 30, 50 and 65**. Treat those values and the route's request/response shape as the module interface when changing clients or providers.

## Repository layout

```text
app/                         Next.js routes and server handlers
components/                  reusable rendering modules
lib/                         domain, browser and infrastructure modules
e2e/                         Playwright behaviour and integration checks
services/quizworld_realtime/ Phoenix application
supabase/migrations/         reviewed database changes
docs/adr/                    architecture decisions
CONTEXT.md                   domain and ownership glossary
```

## Common traps

- Do not add new behaviour to the deprecated Supabase live-game adapter.
- Do not deploy the frontend twice; Vercel Git integration owns it.
- Do not infer database state from historical SQL files.
- Do not use client clocks for multiplayer scoring.
- Do not clear player credentials on transient network failures.
- Do not add page-load tests that make no user-visible assertion.
- Do not add handoff documents; update the authoritative source instead.

## Deployment and rollback

- **Frontend:** Vercel deploys GitHub `main` to `quizworld.xyz`.
- **Realtime:** Render deploys `services/quizworld_realtime` from `main`.
- **Database:** Supabase migrations are reviewed and applied separately.

For a failed application release, revert the production merge on `main` and verify both Vercel and Render health. Database rollbacks require a reviewed forward migration; never run a destructive reset against production.
