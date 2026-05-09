# Developer Guide

## Purpose

Use this guide when changing the current repo across the Next.js frontend and the Phoenix game service.

## Frontend Setup

```bash
npm install
npm run dev
npm run build
npm run check
```

Frontend env:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=http://localhost:4100
```

## Phoenix Setup

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

## Active Runtime Boundaries

- `app/`: existing frontend routes
- `lib/game-engine/`: game runtime config and HTTP helpers
- `supabase/`: quiz/auth/study backend
- `services/quizworld_realtime/`: live multiplayer runtime

The current `v9` integration uses Phoenix REST endpoints for actions and Phoenix Channels for live session updates, with polling kept only as a fallback path.

Phoenix now owns:

- session PIN generation
- host session token issuance
- player id/token issuance
- question timeout -> reveal transitions

The frontend should not recreate those responsibilities.

## Engineering Rules

- Keep auth and content ownership in Supabase.
- Keep live multiplayer state authoritative in Phoenix.
- Do not reintroduce client-authoritative scoring.
- Treat Redis as an optional support layer for single-node development, not the source of truth for authored quiz content.
- Keep Supabase write-back at the game-result summary layer, not live-round mutation.


## Component Cleanup Rules

- Keep `app/**/page.tsx` files as orchestration/container code.
- Put reusable UI in `components/<feature>/`.
- Put route-specific styles in `styles/<feature>.css`, imported from `app/layout.tsx`.
- Do not duplicate share buttons, QR generation, dashboard cards, or study/game panels. Use existing shared components.
- Do not recreate Phoenix responsibilities in the browser: session IDs, PINs, scoring authority, reveal/advance authority, and result sync stay server-side.
- Prefer small extraction commits with full checks over broad rewrites.
