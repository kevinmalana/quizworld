# OpenClaw Handoff For QuizWorld v9

## Package Intent

This repository is no longer a single Vercel-only deployable if you want the full `v9` architecture.

`v9` has two runtime targets:

- Next.js frontend on Vercel
- Phoenix realtime service on a separate host such as Fly.io, Render, or Railway

## Included

- frontend source
- Supabase SQL and legacy migrations
- Phoenix realtime service in `services/quizworld_realtime/`
- current docs

## Frontend Deployment

Vercel settings:

- Framework preset: `Next.js`
- Install command: `npm install`
- Build command: `npm run build`

Frontend env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GAME_ENGINE`
- `NEXT_PUBLIC_GAME_SERVICE_URL`

## Phoenix Deployment

Deploy `services/quizworld_realtime/` to a host that supports Elixir applications.

Phoenix env:

- `PORT`
- `PHX_HOST`
- `SECRET_KEY_BASE`
- `REDIS_URL` optional
- `ALLOWED_ORIGINS`

## Documentation Order

1. [START_HERE.md](./START_HERE.md)
2. [V9_RELEASE.md](./V9_RELEASE.md)
3. [HANDBOOK.md](./HANDBOOK.md)
4. [ARCHITECTURE.md](./ARCHITECTURE.md)
5. [V9_OPERATOR_HANDOFF.md](./V9_OPERATOR_HANDOFF.md)
6. [OPENCLAW_MESSAGE.md](./OPENCLAW_MESSAGE.md)
