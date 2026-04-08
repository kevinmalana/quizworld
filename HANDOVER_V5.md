# Historical Note

This file is a V5-era handoff and should not be used for current deployment or backend decisions.
Use [docs/START_HERE.md](./docs/START_HERE.md) instead.

# QuizWorld v5 Handover

## What this is

This document is the direct handover for the current reviewed version of QuizWorld after the `v5` UI readability pass.

Use this file first if another AI agent or developer is taking over.

## Current project reality

The project is:

- a multi-route Next.js frontend prototype
- locally interactive
- browser-persistent via `localStorage` and `sessionStorage`
- not yet backend-connected

The most important implementation file is:

- [`lib/store.ts`](./lib/store.ts)

## What changed in v5

The main issue reported was poor readability and answer UX.

The `v5` pass fixed the most critical problems by making the app easier to read under pressure.

### Main changes

- toned down the global palette and shadow intensity
- reduced exaggerated motion on core interaction surfaces
- improved contrast on gameplay screens
- moved question text onto light readable cards
- changed answer cards so they use light surfaces and dark text
- made selected/correct/wrong states clearer without relying only on color
- improved study-mode answer readability with the same principles
- added reduced-motion handling in global CSS

### Main files touched in the v5 pass

- [`app/globals.css`](./app/globals.css)
- [`app/game/[pin]/page.tsx`](./app/game/[pin]/page.tsx)
- [`app/study/[id]/page.tsx`](./app/study/[id]/page.tsx)

## What still exists technically

### Working prototype features

- local quiz creation
- local quiz browsing
- local host flow
- local join flow
- local game loop
- local study loop
- local dashboard/profile persistence

### Still simulated

- backend
- auth
- real multiplayer
- cross-device sessions
- AI generation

## Biggest known limitation

The host/join/game loop is still local-browser only.

Why:

- sessions are stored under `qw_session_<PIN>` in localStorage
- another browser or device cannot access that data

So the current system is a UI/interaction prototype, not a true live game product.

## What to protect going forward

Do not regress the `v5` readability gains.

### Especially protect

- gameplay question readability
- answer button contrast
- study mode answer legibility
- reduced visual noise during time-sensitive tasks

### Avoid

- white text on saturated answer backgrounds by default
- unnecessary heavy pulses on critical CTAs
- overly deep shadows on every element
- noisy motion around question content
- state communication that depends only on color

## Recommended next priorities

### Product/engineering

1. Replace local session storage with a real backend
2. Add real quiz persistence and ownership
3. Add authentication
4. Add realtime host/player syncing
5. Replace simulated AI with a real generation service

### Frontend/UI

1. Apply the same readability standards to `create`, `host`, `dashboard`, and `explore`
2. Tighten spacing and typography consistency
3. Keep homepage expressive, but keep gameplay/study surfaces calmer

## How to run

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Verified state at handoff

- app builds successfully
- dynamic routes build successfully
- docs now match the current codebase more closely

## Files another agent should read first

1. [`HANDOVER_V5.md`](./HANDOVER_V5.md)
2. [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
3. [`README.md`](./README.md)
4. [`UI_UX_GUIDELINES.md`](./UI_UX_GUIDELINES.md)
5. [`DEVELOPER_ONBOARDING.md`](./DEVELOPER_ONBOARDING.md)
6. [`BACKEND_ARCHITECTURE.md`](./BACKEND_ARCHITECTURE.md)
7. [`lib/store.ts`](./lib/store.ts)
