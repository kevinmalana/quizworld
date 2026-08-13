# QuizWorld domain and system context

This file names the concepts and ownership rules that should remain stable across refactors.

## Product concepts

- **Quiz**: authored questions and answers stored in Supabase.
- **Live game**: a host-controlled multiplayer quiz identified by a six-character PIN.
- **Host**: authenticated user who creates and controls a live game.
- **Player**: anonymous or authenticated participant with a server-issued player ID and token.
- **Game phase**: `waiting`, `active`, `reveal`, or `finished`.
- **Game mode**: `classic`, `survival`, or `team`.
- **Presentation**: an interactive slide deck with presenter and audience roles. It is separate from a live game.
- **Study session**: client-driven solo practice using flashcards or quickfire.

## Runtime ownership

- **Vercel / Next.js** owns the website, auth UI, authoring, study, social pages and browser clients.
- **Render / Phoenix** is authoritative for live-game state, timing, answer locking, scoring and phase transitions.
- **Redis** stores recoverable Phoenix snapshots. A live game should survive a Phoenix process restart while its snapshot exists.
- **Supabase** owns durable product data, authentication and completed results.
- The browser may display and request live-game transitions, but it must not become the authority for game rules or durable completion.

## Live-game invariants

- Each accepted transition is committed and published once.
- The server controls question start time and answer acceptance.
- Host and player credentials are server-issued and validated server-side.
- Reconnection restores the latest authoritative snapshot.
- Clients may ignore stale snapshots, but backend correctness must not depend on client-side deduplication.
- Completion writes must be idempotent before browser-owned result writes are removed.

## Deployment ownership

- Vercel's Git integration deploys `main` to `quizworld.xyz`.
- GitHub Actions verifies code. It does not perform a second Vercel deployment.
- Render deploys the Phoenix service from `services/quizworld_realtime`.
- Supabase schema changes use reviewed SQL migrations and are applied separately from application deployment.

## Current refactor direction

1. Keep one publication point for Phoenix transitions.
2. Replace false-confidence E2E checks with deterministic behaviour tests.
3. Remove the legacy Supabase live-game adapter only after its rollback status is explicitly confirmed.
4. Move live-game orchestration behind a small runtime interface.
5. Move result, XP and achievement completion to an idempotent backend module.
