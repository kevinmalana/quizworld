# QuizWorld Realtime

This is the `v9` Phoenix/Elixir game engine for QuizWorld.

## Purpose

The existing Next.js app still handles:

- marketing pages
- Supabase auth
- quiz authoring
- dashboard, study, and profile flows

This service is the new authoritative runtime for live multiplayer sessions:

- host-controlled game sessions
- anonymous player join
- server-generated PIN creation for Phoenix-hosted sessions
- server-generated player identity and player token issuance
- server-side answer locking
- server-owned question timeout and auto-reveal
- server-side reveal and scoring
- Phoenix Channels for realtime fan-out
- optional LiveView game screen under `/live/game/:pin`
- optional Redis snapshot persistence
- end-of-game result write-back to Supabase

The LiveView surface is intended to feel like a dedicated game stage, with a host deck, player join card, animated leaderboard, round timer, reveal state, and final results view.

## Local Requirements

- Elixir
- Erlang/OTP
- Phoenix dependencies via `mix deps.get`

These tools are not installed in the current workspace, so this service was scaffolded manually and should be verified in an Elixir-capable environment.

## Key Files

- `mix.exs`
- `config/runtime.exs`
- `lib/quizworld_realtime/application.ex`
- `lib/quizworld_realtime/games.ex`
- `lib/quizworld_realtime/game_server.ex`
- `lib/quizworld_realtime_web/channels/game_channel.ex`
- `lib/quizworld_realtime_web/live/game_live/show.ex`

## Environment

```bash
PORT=4100
PHX_HOST=localhost
SECRET_KEY_BASE=replace-me
REDIS_URL=redis://localhost:6379/0
ALLOWED_ORIGINS=http://localhost:3000,https://www.quizworld.xyz
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Run

```bash
mix deps.get
mix phx.server
```

## Current Runtime Notes

- Phoenix currently enforces `classic` mode only. Other modes should stay hidden until implemented server-side.
- The service now includes a small `ExUnit` test suite under `test/`.
- Redis is still optional for single-node development, but multi-node production should not be treated as safe without shared realtime state.

## API Surface

- `GET /api/health`
- `POST /api/sessions`
- `GET /api/sessions/:pin`
- Channel topic: `game:<PIN>`
- LiveView route: `/live/game/:pin`
