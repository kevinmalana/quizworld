# Testing Guide

## Purpose

Use this guide for the current split-runtime smoke/regression test.

## Frontend Checks

- `npm run check` passes
- `npm run quality` passes without increasing inline styles, type escapes, large route files, or duplicate Phoenix roots
- frontend env vars are set
- Supabase auth and quiz content load normally
- builder draft autosave works when signed in
- builder remains usable on mobile/tablet breakpoints
- preview is reachable on small screens
- timer and points can be edited on small screens
- URL import works from `/create`
- document import works from `/create`
- AI topic, URL, document, and pasted-source starts open the correct source modal
- AI generation options expose audience, difficulty, question type, tone, and focus controls
- AI Source Draft returns validated, cited output when AI env vars are configured
- AI source drafts preserve question type, explanation, timing, scoring, and answer correctness after loading into the builder
- AI enrichment can add explanations/difficulty/confidence to manually-created questions when AI env vars are configured

## Phoenix Checks

- `mix deps.get`
- `mix phx.server`
- `mix test`
- `GET /api/health` returns `ok`
- `POST /api/sessions` creates a live session and returns a server-generated PIN plus host token
- `GET /api/sessions/:pin` returns the expected snapshot
- `POST /api/sessions/:pin/join` returns a server-generated player id plus player token
- `POST /api/sessions/:pin/start|answer|reveal|advance` all respond correctly
- questions auto-reveal when the answer window expires even if the host does nothing
- finishing a game writes a row through `record_game_result`

## End-To-End Focus

1. Sign in on the frontend.
2. Create or import a quiz draft.
3. Publish or republish the quiz.
4. Start a live session via the Phoenix runtime.
5. Join from a second browser/device.
6. Submit answers and verify reveal/scoring happens from the service.
7. Confirm the study/dashboard/profile flows still work through Supabase.

## Local Vs Production Live Game Expectations

The frontend defaults to the Phoenix live engine. Locally, if `NEXT_PUBLIC_GAME_SERVICE_URL` is missing, `/join` and `/host` intentionally render `Live Game Service Not Configured` instead of the player PIN/host auth screens.

Current Playwright coverage accepts either:

- configured live-game entry surfaces, or
- the explicit configuration-status screen when Phoenix env is absent.

Production runs should use `BASE_URL=https://www.quizworld.xyz` and should exercise the configured Phoenix path.

## Current Baseline

Latest 2026-05-14 local checks passed:

- `npm run quality`
- `npm run typecheck`
- `npm run check`
- Local Playwright: `40/40` via `npm run test:e2e`

Latest production baseline:

- Route smoke: `200` for `/`, `/create`, `/explore`, `/study`, `/dashboard`, `/host`, `/join`, `/present`, `/present/join`, `/game/NOPE01`, `/sitemap.xml`
- Phoenix tests: `29/29`
- Production Playwright: `40/40` via `BASE_URL=https://www.quizworld.xyz npm run test:e2e` after deploy `dpl_FaY2PResJBuMdtuJXL58GWf3FCkB`.
- Phoenix health: `redis:true`

For high-risk game changes, also run an authenticated host + second-browser/mobile player smoke test through finish/leaderboard.
