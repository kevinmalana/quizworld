# QuizWorld engineering handbook

Read `CONTEXT.md` first. It defines the domain terms and runtime ownership rules. Decisions that should not be reversed casually live in `docs/adr/`.

## Data ownership

### Supabase

Supabase owns durable application data:

- quizzes, questions and answers
- profiles and authentication
- study progress and social data
- presentation records
- completed game results

Row-level security and RPC access must be reviewed against the actual production schema before migrations are applied.

Important public entry points include PIN lookup and server-controlled join/answer flows. Direct anonymous table access should not be added when a narrow RPC can expose only the required fields.

### Phoenix and Redis

Phoenix owns active multiplayer games:

- host commands
- player join and reconnect
- question timing
- answer locking
- reveal and scoring
- `classic`, `survival`, and `team` mode state
- WebSocket publication

Redis stores recovery snapshots. Phoenix can run locally without Redis, but production restart recovery depends on it.

Every accepted transition is persisted and published once from `GameServer`. Controllers, `Games` and channels return the transition result; they do not publish it again.

### Next.js

Next.js owns the browser experience, authoring, study modes, presentations and social pages. The live-game browser client requests Phoenix commands and renders authoritative snapshots.

The category colour and emoji maps live in `lib/shared.ts`.

## Authentication

Frontend auth is provided by `useAuth()` from `components/supabase-provider.tsx`.

Use the loading state before deciding whether a user is signed in. Protected browser actions should preserve an intended return path when redirecting to login.

Phoenix host creation verifies a Supabase bearer token. Host and player session credentials are server-issued and must not be trusted merely because a client supplied a value.

## Live-game client

Relevant modules:

- `lib/game-engine/client.ts`: HTTP commands
- `lib/game-engine/phoenix-socket.ts`: channel subscription and reconnect policy
- `lib/game/session-normalizers.ts`: snapshot normalization
- `app/game/[pin]/page.tsx`: current orchestration and rendering route

The game route still contains a deprecated Supabase live-game adapter. Do not add new behaviour to that adapter. Its removal requires explicit confirmation that it is not an active rollback path.

## AI features

Quiz generation uses `POST /api/ai-source-draft`. Provider URL, model and API key come from environment variables; `.env.example` is the current configuration reference.

Supported generated question counts are 5, 10, 20, 30, 50 and 65.

## Testing

- TypeScript and import safety: `npm run typecheck` and `npm run build`
- Frontend quality guard: `npm run quality`
- Phoenix: `npm run check:phoenix`
- Browser behaviour: `npm run test:e2e`

Do not add browser tests that only load a page and assert `true`. Type and import failures belong in typecheck/build. Browser tests should assert user-visible behaviour or a concrete network/security result.

The current E2E suite still has production-coupled checks. The target design is:

1. deterministic candidate-build tests with isolated fixtures
2. a small, read-only post-deploy production smoke suite

## Deployments

- Vercel Git integration owns frontend production deployment.
- GitHub Actions owns verification only.
- Render owns Phoenix deployment from `services/quizworld_realtime`.
- Supabase migrations are applied separately after schema review.

Do not add a second active deployment path without replacing ADR 0001.
