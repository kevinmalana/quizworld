# Project Status

## Snapshot

Verified on March 27, 2026:

- This repository is now aligned around `QuizWorld v9`.
- The Next.js frontend still builds locally with `npm run build`.
- A new Phoenix realtime service has been added under `services/quizworld_realtime/`.
- Supabase remains the content/auth backend.
- The Phoenix service was scaffolded but not compiled in this workspace because Elixir tooling is not installed locally.

## Working Areas

- sign in / sign up
- quiz creation and content persistence in Supabase
- dashboard, explore, study, and profile flows
- new Phoenix service structure for live session ownership, scoring, and realtime fan-out

## Deployment Requirements

- Frontend env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Frontend env for v9 rollout: `NEXT_PUBLIC_GAME_ENGINE`, `NEXT_PUBLIC_GAME_SERVICE_URL`
- Phoenix env: `PORT`, `PHX_HOST`, `SECRET_KEY_BASE`
- Phoenix result-sync env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional Phoenix env: `REDIS_URL`, `ALLOWED_ORIGINS`
- Supabase remains required for quiz/auth data

## Source Of Truth

1. [docs/START_HERE.md](./docs/START_HERE.md)
2. [docs/V9_RELEASE.md](./docs/V9_RELEASE.md)
3. [docs/HANDBOOK.md](./docs/HANDBOOK.md)
4. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
5. [services/quizworld_realtime/README.md](./services/quizworld_realtime/README.md)
