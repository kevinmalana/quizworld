# OpenClaw Handoff Message

Use this message as the operator handoff text for `QuizWorld v9`.

```text
Deploy QuizWorld v9 as two services:

1. Frontend on Vercel
2. Phoenix realtime service from services/quizworld_realtime on a host that supports Elixir

Frontend env:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_GAME_ENGINE=phoenix
- NEXT_PUBLIC_GAME_SERVICE_URL=https://your-phoenix-host

Phoenix env:
- PORT
- PHX_HOST
- SECRET_KEY_BASE
- REDIS_URL (optional)
- ALLOWED_ORIGINS

Canonical docs:
1. docs/START_HERE.md
2. docs/V9_RELEASE.md
3. docs/HANDBOOK.md
4. docs/ARCHITECTURE.md
5. docs/V9_OPERATOR_HANDOFF.md
6. services/quizworld_realtime/README.md
```
