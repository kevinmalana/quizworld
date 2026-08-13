# QuizWorld

QuizWorld is a multiplayer quiz app. A host selects a quiz and receives a PIN; players join from their phones. The product also includes quiz authoring, AI-assisted imports, study modes, interactive presentations and social features.

Production: https://www.quizworld.xyz

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

`CONTEXT.md` defines the product terms and runtime ownership rules. Architecture decisions are recorded in `docs/adr/`.

## Local development

Requirements:

- Node.js 20+
- npm
- Elixir 1.17 and Erlang/OTP 27 for the realtime backend

Frontend:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Phoenix backend:

```bash
cd services/quizworld_realtime
mix deps.get
mix phx.server
```

Use `.env.phoenix.example` as the list of backend variables. Do not commit credentials.

## Verification

```bash
npm run quality
npm run typecheck
npm run build
npm run check:phoenix
npm run test:e2e
```

`npm run check` runs the quality guard, typecheck, production build and Phoenix checks. Browser tests are separate because they are slower and some currently exercise deployed dependencies.

## Deployment

### Frontend

Vercel's Git integration deploys `main` to `quizworld.xyz`. GitHub Actions verifies the code but does not perform a second Vercel deployment. See ADR 0001.

### Live-game backend

Render deploys `services/quizworld_realtime` using `render.yaml`. Phoenix is authoritative for hosted multiplayer games. See ADR 0002.

Required production variables are declared in the Render blueprint as dashboard-managed values. Redis is required for restart recovery.

### Database

Supabase changes are reviewed as SQL migrations under `supabase/migrations/` and applied separately from application deployment. `supabase_setup.sql` is a historical bootstrap, not proof that production has every later migration.

Before applying SQL, verify the target schema and the migration's assumptions. Do not paste an old aggregate SQL bundle into production without review.

## Live-game notes

- PINs contain six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Modes: `classic`, `survival`, and `team`.
- Phoenix broadcasts snapshots through `game:<PIN>` channels.
- Redis stores recovery snapshots for active games.
- Supabase stores durable quiz data and completed results.

## Repository layout

```text
app/                         Next.js routes
components/                  UI modules
lib/game-engine/             Phoenix browser adapter
services/quizworld_realtime/ Phoenix application
e2e/                         Playwright behaviour and production-integration checks
supabase/migrations/         ordered database changes
docs/adr/                    architecture decisions
```
