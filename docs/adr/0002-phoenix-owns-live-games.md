# ADR 0002: Phoenix owns live multiplayer games

- Status: Accepted
- Date: 2026-08-13

## Context

QuizWorld previously supported live-game state through Supabase. Production now uses the Phoenix engine on Render, but frontend routes still contain a legacy Supabase adapter and repeated engine branches.

Phoenix already owns live-game timing, phase transitions, answer locking, scoring, WebSocket publication and Redis recovery snapshots.

## Decision

Phoenix is the authoritative runtime for hosted multiplayer games.

New live-game behaviour must be implemented in Phoenix first. The browser requests commands and renders snapshots; it does not decide game rules.

The legacy Supabase live-game adapter is deprecated. Removing it is a separate refactor that requires confirmation that it is not an active rollback mechanism.

## Consequences

- Live-game rules have one authority.
- Backend transitions must publish exactly once.
- Browser polling is a reconnection fallback, not the normal update path.
- Solo study/gameplay can remain client-driven, but differences in scoring or timing must be explicit.
