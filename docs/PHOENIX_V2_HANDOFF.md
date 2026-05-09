# Phoenix V2 Handoff

## What This Package Adds

This handoff includes the hardened Phoenix realtime pass on top of the earlier `v9` hybrid architecture.

The core Phoenix service is still:

- `services/quizworld_realtime/`

But the runtime contract is now tighter and safer than the first Phoenix cut.

## Main Changes In This V2 Package

- Phoenix now generates the live session PIN when the frontend hosts through the Phoenix engine.
- Phoenix now generates player ids server-side instead of trusting a browser-provided id.
- Host actions use a private host token instead of a public host id.
- Public live session snapshots no longer expose answer correctness before reveal.
- Phoenix auto-reveals a question when the answer window expires.
- Finished-game result sync now runs asynchronously instead of blocking the game process.
- Game processes now schedule cleanup for stale and finished sessions.
- Duplicate nicknames are blocked within the same live game.
- The frontend host UI now only exposes `classic` mode until more modes are actually implemented server-side.
- A first Phoenix `ExUnit` test suite was added.

## New Or Updated Files To Review First

### Phoenix core

- `services/quizworld_realtime/lib/quizworld_realtime/game.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/game_server.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/games.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/pin.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/result_sync.ex`
- `services/quizworld_realtime/lib/quizworld_realtime/state_store.ex`

### Phoenix web layer

- `services/quizworld_realtime/lib/quizworld_realtime_web/controllers/session_controller.ex`
- `services/quizworld_realtime/lib/quizworld_realtime_web/channels/game_channel.ex`
- `services/quizworld_realtime/lib/quizworld_realtime_web/live/game_live/show.ex`

### Frontend integration

- `app/host/page.tsx`
- `app/join/page.tsx`
- `app/game/[pin]/page.tsx`
- `lib/game-engine/client.ts`
- `lib/host-session.ts`
- `lib/player-session.ts`

### Tests

- `services/quizworld_realtime/test/test_helper.exs`
- `services/quizworld_realtime/test/quizworld_realtime/game_test.exs`

## What Still Needs Runtime Validation

This workspace still cannot compile or run Phoenix because Elixir tooling is not installed here. So this package is code-complete for the hardening pass, but it still needs real validation on a laptop or VPS with:

- `mix deps.get`
- `mix test`
- `mix phx.server`

## Recommended First Validation

1. Run Phoenix locally or on the VPS.
2. Host a game from the Next frontend with `NEXT_PUBLIC_GAME_ENGINE=phoenix`.
3. Confirm the returned Phoenix session PIN is server-generated.
4. Join with two different nicknames and confirm duplicate nickname rejection.
5. Let a round time out without clicking reveal and confirm auto-reveal happens.
6. Finish the game and confirm `game_results` is written in Supabase.
