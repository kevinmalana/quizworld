# Testing Guide

## Purpose

Use this guide for the `v12` split-runtime smoke test.

## Frontend Checks

- `npm run build` passes
- frontend env vars are set
- Supabase auth and quiz content load normally
- builder draft autosave works when signed in
- builder remains usable on mobile/tablet breakpoints
- preview is reachable on small screens
- timer and points can be edited on small screens
- URL import works from `/create`
- document import works from `/create`
- AI Source Draft returns cited review output when AI env vars are configured
- AI source drafts keep the correct source type after loading into the builder

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

## Constraint

This workspace can verify the Next.js build, but it cannot compile or run Phoenix locally without installing Elixir tooling.
