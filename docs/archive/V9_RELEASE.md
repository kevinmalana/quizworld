# QuizWorld v9 Release Notes

## Release Intent

`v9` introduces a dedicated Phoenix realtime service so live multiplayer no longer depends on a mixed browser/Supabase-only authority model.

## What Changed

- Added `services/quizworld_realtime/` as a Phoenix game-engine service.
- Added Phoenix Channels, in-memory game processes, and optional Redis snapshot persistence.
- Added frontend env/config helpers for selecting a game engine.
- Wired `app/host`, `app/join`, and `app/game/[pin]` to use Phoenix session APIs when `NEXT_PUBLIC_GAME_ENGINE=phoenix`.
- Wired `/game/[pin]` to receive live Phoenix channel updates, with polling retained only as a fallback.
- Added Supabase game result persistence through `record_game_result` and the `game_results` table.
- Added a Phoenix LiveView game surface for the live-game layer at `/live/game/:pin`.
- Polished the LiveView game surface into a stage-style host/player experience with responsive layout, animated leaderboard cards, round countdown, reveal state, and final results presentation.
- Hardened the Phoenix runtime so it now owns PIN issuance, player identity issuance, host session tokens, auto-reveal timers, and async result sync.
- Reduced the frontend game-mode promise to `classic` until additional server-side rules exist.
- Reframed docs around a two-service deployment model.

## Service Split

- Supabase: auth, quiz content, study, profile
- Phoenix: host/join/game session runtime
- Redis: optional snapshot support for Phoenix
- Vercel: frontend deployment

## Important Constraint

The Phoenix service was scaffolded and the Next.js frontend now targets it, but Phoenix itself was not compiled in this workspace because Elixir tooling is not installed locally here.
