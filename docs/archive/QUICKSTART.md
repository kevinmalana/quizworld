# Quick Start

## 1. Frontend

```bash
npm install
npm run dev
```

## 2. Frontend Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=http://localhost:4100
QUIZWORLD_AI_API_KEY=...
QUIZWORLD_AI_MODEL=...
QUIZWORLD_AI_API_URL=https://<openai-compatible-endpoint>/v1/chat/completions
```

## 3. Supabase

Use the existing QuizWorld Supabase project for auth and content data.

Required current migrations:

- `20260327_v92_game_results.sql`
- `20260331_v93_production_hardening.sql`
- `20260331_v94_quiz_drafts.sql`
- `20260331_v95_quiz_versioning.sql`
- `20260331_v96_quiz_archive.sql`

## 4. Phoenix Service

```bash
cd services/quizworld_realtime
mix deps.get
mix phx.server
```

Phoenix env:

```bash
PORT=4100
PHX_HOST=localhost
SECRET_KEY_BASE=replace-me
REDIS_URL=redis://localhost:6379/0
ALLOWED_ORIGINS=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 5. Verify

- frontend loads
- `/api/health` on Phoenix returns `ok`
- frontend can reach `NEXT_PUBLIC_GAME_SERVICE_URL`
- `/create` can save drafts when signed in
- URL import works from `/create`
- AI Source Draft works when AI env vars are configured
