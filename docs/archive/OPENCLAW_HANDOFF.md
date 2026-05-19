# OpenClaw Handoff For QuizWorld

## Package Intent

This repository is the current production QuizWorld source. For the fastest up-to-date map, read `docs/CURRENT_AGENT_HANDOFF.md` first.

QuizWorld has two runtime targets:

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

1. [CURRENT_AGENT_HANDOFF.md](./CURRENT_AGENT_HANDOFF.md)
2. [START_HERE.md](./START_HERE.md)
3. [ARCHITECTURE.md](./ARCHITECTURE.md)
4. [DEV_GUIDE.md](./DEV_GUIDE.md)
5. [TESTING_GUIDE.md](./TESTING_GUIDE.md)
6. [HANDBOOK.md](./HANDBOOK.md)
7. [V9_RELEASE.md](./V9_RELEASE.md) — historical context
8. [V9_OPERATOR_HANDOFF.md](./V9_OPERATOR_HANDOFF.md)
9. [OPENCLAW_MESSAGE.md](./OPENCLAW_MESSAGE.md)


## Current OpenClaw Deploy Notes

Normal GitHub auth may be stale. In this workspace, the reliable path is token URL push using `/root/.openclaw/secrets/gh_token.txt`, then Vercel deploy using `/root/.openclaw/secrets/deployment.env`. See `docs/CURRENT_AGENT_HANDOFF.md` for exact commands and verification.
