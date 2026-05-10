# QuizWorld Current Agent Handoff

Last verified: 2026-05-10 06:40 UTC
Production: https://www.quizworld.xyz
Repo: https://github.com/kevinmalana/quizworld
Workspace: `/root/.openclaw/workspace/quizworld`

## Read This First

This file is the fast path for future agents. Older docs contain useful history, but some still say `v9` or `v12`. Treat this document, `README.md`, `docs/START_HERE.md`, and `docs/ARCHITECTURE.md` as the current map.

## Current Runtime

QuizWorld is a split-runtime app:

- **Next.js 16 / React 19 on Vercel**: UI, auth screens, quiz builder, dashboard, explore, study, present, host/join/game frontend.
- **Supabase**: auth, quiz content, questions/answers, drafts, versions, study progress, final game summaries.
- **Phoenix/Elixir on Render**: authoritative live game sessions, PINs, joins, answers, reveal/advance/finish events.
- **Redis**: configured for Phoenix production snapshot/shared state support.
- **Groq-compatible AI endpoint**: quiz/source draft generation via Next.js API routes.

## Current Source Of Truth

Important paths:

```text
app/                              Next.js App Router routes
app/create/page.tsx               quiz builder container only; UI extracted
app/game/[pin]/page.tsx           live game container; panels extracted
app/study/[id]/page.tsx           study session container; panels extracted
app/present/[code]/live/page.tsx  live presentation container; slide/status UI extracted
components/builder/               builder UI components
components/game/                  live game panels
components/study/                 study hall/session UI components
components/present/live/          live presentation stage/status/dock components
components/dashboard/             dashboard cards
components/explore/               explore cards
components/shared/                reusable QR, metric, status, share helpers
lib/builder/                      builder conversion/factory helpers
lib/game/                         game analytics/session/audio helpers
lib/game-engine/                  Phoenix client/config/socket helpers
lib/study/                        study types
styles/builder.css                builder-specific CSS
styles/game.css                   game-specific CSS
styles/present.css                present-specific CSS
styles/study.css                  study-specific CSS
services/quizworld_realtime/      only Phoenix source of truth
```

Do **not** revive old duplicate Phoenix roots from workspace siblings or historical ZIP folders. The active Phoenix app is only `services/quizworld_realtime/` inside this repo.

## Recent Cleanup Summary

The 2026-05-09 cleanup passes reduced AI-slop by extracting large route UI into components and removing duplicated/stale code.

Key outcomes:

- Removed stale production `/phoenix-preview` mock route.
- Removed duplicate root Phoenix source; kept `services/quizworld_realtime` only.
- Moved game/present styles out of global/runtime injection into CSS files.
- Added shared public config helpers and reusable QR component.
- Added `npm run check` as the main gate: TypeScript + Next build + Phoenix compile/tests.
- Extracted game helpers, game panels, dashboard cards, explore cards, study cards, builder workspace, source modals, study session panels, and live presentation stage/status/dock components.

Current approximate route file sizes after cleanup:

```text
app/game/[pin]/page.tsx    ~909 lines, 17 inline styles
app/present/[code]/live/page.tsx ~431 lines, 0 route inline styles; 2 dynamic component styles
app/create/page.tsx        ~492 lines, 0 inline styles
app/dashboard/page.tsx     ~444 lines, 20 inline styles
app/study/[id]/page.tsx    ~223 lines, 0 inline styles
app/study/page.tsx         ~249 lines, 30 inline styles
app/explore/page.tsx       ~549 lines, 46 inline styles
```

## Verification Baseline

Latest local gate after the 2026-05-10 live presentation refactor:

```bash
npm run check
```

Results:

- TypeScript passed.
- Next production build passed.
- Phoenix compile with warnings-as-errors passed.
- Phoenix tests passed: `29/29`.

Latest production/browser baseline from 2026-05-09:

```bash
BASE_URL=https://www.quizworld.xyz npx playwright test --project=chromium
```

- Playwright production suite passed: `39/39`.
- Production route smoke passed for `/`, `/create`, `/study`, `/study/[id]`, `/dashboard`, `/explore`, `/host`, `/join`, `/present`, `/game/NOPE01`.
- Phoenix health returned `{"status":"ok","service":"quizworld_realtime","redis":true}`.
- Authenticated live host + mobile player game flow passed with no host/player console errors after the game/dashboard cleanup.

## Deploy Pattern

Use stored deployment credentials; do not declare blocked until checking these files:

```bash
GH_TOKEN=$(tr -d '\n' < /root/.openclaw/secrets/gh_token.txt)
git push "https://x-access-token:${GH_TOKEN}@github.com/kevinmalana/quizworld.git" HEAD:main

source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```

After deploy, verify the production alias:

```bash
curl -I https://www.quizworld.xyz
curl -sS https://quizworld-xs0g.onrender.com/api/health
BASE_URL=https://www.quizworld.xyz npx playwright test --project=chromium
```

## Safe Future Cleanup Targets

Recommended order:

1. `app/present/[code]/edit/page.tsx` — extract slide list/editor/modal sections. Moderate value.
2. `app/explore/page.tsx` — move remaining filter/sort/header CSS/components. Low risk.
3. `app/study/page.tsx` — move remaining dashboard layout styles into CSS. Low risk.
4. `app/game/[pin]/page.tsx` — only do further logic extraction with live host/player smoke tests. Higher risk.

Avoid broad rewrites. Prefer small PR-style extractions, then run the full gates above.

## Known Product/Ops Notes

- `www.quizworld.xyz` is the public production alias.
- Direct Vercel deployment URLs may show Vercel protection; use production aliases for public smoke.
- Phoenix backend: `https://quizworld-xs0g.onrender.com`.
- Present icon should remain `🎤`; Host icon is `🏁`; Join/player icon is `🎮`.
- There was a production test presentation created during smoke testing: `Phase 1 UI Smoke 2026-05-09`, id `1f6fa58f-4e43-4894-b608-3476297a6632`, join code `5506DD`.
- GitHub normal auth may fail; token URL push is the reliable path.
