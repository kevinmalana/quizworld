# QuizWorld realtime backend

Phoenix is the authoritative runtime for QuizWorld hosted multiplayer games.

It owns:

- session creation and server-generated PINs
- host and player credentials
- player join and reconnect
- question timing and answer locking
- reveal, scoring and phase transitions
- `classic`, `survival`, and `team` modes
- Phoenix Channel updates
- Redis recovery snapshots
- completed-result synchronization to Supabase

## Requirements

- Elixir 1.17
- Erlang/OTP 27
- Phoenix dependencies from `mix deps.get`
- Redis in production for restart recovery

## Environment

See the repository's `.env.phoenix.example`.

Required in production:

- `SECRET_KEY_BASE`
- `SESSION_SIGNING_SALT`
- `PHX_HOST`
- `ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`

`PORT` defaults to `4100` locally and is supplied by Render in production.

## Run locally

```bash
mix deps.get
mix phx.server
```

## Verify

```bash
mix format --check-formatted
MIX_ENV=test mix compile --warnings-as-errors
MIX_ENV=test mix test
# Requires redis-server on PATH; all Redis tests own isolated local instances.
MIX_ENV=test mix run --no-start test/support/restart_probe.exs
```

## Runtime model

Each active PIN has a `GameServer` process. Accepted transitions flow through one commit point in `GameServer`, which prepares timers, creates the public snapshot, stores recovery state and publishes one `session:update` event.

Public game snapshots contain counts and leaderboard data only. Host channels use a
validated host token; player channels use a validated player ID/token and receive
only that player's current answer. Finished games checkpoint an outbox entry and retry
`record_game_result_v2` using the existing immutable game-instance deduplication key.
Pending snapshots, outbox payloads, and the Redis pending index have no expiry;
ordinary active/successful snapshots retain the six-hour TTL. Outbox entries are
instance-scoped, so PIN reuse and room cleanup cannot erase unsent reports.

`ResultRecovery` runs at application boot and every 30 seconds without client
traffic. It scans incrementally (SCAN/SSCAN, not KEYS), promotes surviving legacy
pending checkpoints with compare-and-set, and retries with at most four concurrent
RPC calls per node and a 60-second attempt deadline. Failed/uncertain RPCs and
acknowledgements retain the outbox for the next pass. Live game actors retain their
existing exponential retry schedule. Duplicate sends across actors/nodes are safe
only because the existing v2 RPC is idempotent by game instance.

Checkpoint failures return errors, emit an error log and the telemetry event
`[:quizworld_realtime, :checkpoint, :failure]`, and schedule a coalesced one-second
retry of the latest in-memory state; gameplay is not rejected. A Redis outage
followed by loss of the game process before any successful checkpoint still cannot
be recovered. Use persistent, non-evicting Redis (AOF/managed durability); removing
an application TTL does not protect against Redis data loss or eviction.

Presentation live sessions are immutable runs identified by `run_id`. Presenter,
participant, snapshot, slide, and activity cache entries are run-scoped, so a token
from an earlier run cannot authorize a later one. HTTP presenter credentials use
`Authorization: Bearer <presenter-token>`; participant activity credentials use
`Authorization: Participant <participant-id>:<participant-token>`. Query-string
credential fallback is intentionally not supported.

`Games` restores missing processes from Redis and calls `GameServer`. Controllers and channels translate transport input/output; they do not own game rules or republish transitions.

## Endpoints

- `GET /api/health`
- `POST /api/sessions`
- `GET /api/sessions/:pin`
- session action routes under `/api/sessions/:pin/*`
- Phoenix Channel topic `game:<PIN>`
- optional LiveView stage `/live/game/:pin`

## Production

Render uses the repository's `render.yaml` with `services/quizworld_realtime` as the root directory. Secret values are managed in Render and must not be committed.

This repair requires no frontend or schema rollout. Before deploying the service,
verify the existing `record_game_result_v2`/game-instance uniqueness migration and
`quizzes.archived_at` are already installed (the baseline service/schema contract).
The v1 checkpoint encoding stays readable; boot recovery adopts still-existing
legacy snapshots, but cannot reconstruct records that already expired. Keep Redis
outbox keys on rollback; old binaries will not drain them, and can reapply the old
TTL to PIN snapshots. Redeploying the repaired service resumes the retained outbox.

Shared-IP HTTP budgets are finite and IP-wide across PINs: 2,000 joins/minute,
24,000 answers or session/presentation snapshots/minute, and 48,000 presentation
activity polls/minute. These cover four simultaneous 200-person classes, two join
attempts per player and double the five-second fallback polling/answer workload
(activity polls every 2.5 seconds). Host/create limits are unchanged. These are
shared-school budgets, not a replacement for ingress abuse controls; the existing
forwarded-IP handling requires a trusted proxy that overwrites client IP headers.
Redis limiter failures continue to fail open for gameplay availability.
