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
```

## Runtime model

Each active PIN has a `GameServer` process. Accepted transitions flow through one commit point in `GameServer`, which prepares timers, creates the public snapshot, stores recovery state and publishes one `session:update` event.

Public game snapshots contain counts and leaderboard data only. Host channels use a
validated host token; player channels use a validated player ID/token and receive
only that player's current answer. Finished games keep a persisted result-sync
status and retry the idempotent `record_game_result(pin)` call until it succeeds or
the session is cleaned up.

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
