# QuizWorld Current Agent Handoff

Last verified: 2026-05-14 20:29 UTC
Production alignment checked: 2026-05-14 20:29 UTC, aligned with local workspace
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
- **Groq-compatible AI endpoint**: source/topic/URL/document quiz draft generation and question enrichment via Next.js API routes.

## Current Source Of Truth

Important paths:

```text
app/                              Next.js App Router routes
app/create/page.tsx               quiz builder container only; UI extracted
app/game/[pin]/page.tsx           live game container; panels extracted
app/study/[id]/page.tsx           study session container; panels extracted
app/present/[code]/live/page.tsx  live presentation container; slide/status UI extracted
app/present/[code]/edit/page.tsx    presentation editor container; panels extracted
components/builder/               builder UI components
components/builder/SourcePicker.tsx source mode picker: manual, paste, AI topic, AI URL, AI document
components/builder/CreateSourceModals.tsx source import modals plus AI generation options
components/game/                  live game panels
components/study/                 study hall/session UI components
components/present/live/          live presentation stage/status/dock components
components/present/edit/          presentation editor panels
components/dashboard/             dashboard cards
components/explore/               explore cards
components/shared/                reusable QR, metric, status, share helpers
lib/builder/                      builder conversion/factory helpers
lib/quiz-ai.ts                    AI draft validation, prompt building, enrichment prompt, duplicate detection
app/api/ai-source-draft/route.ts  AI quiz generation endpoint
app/api/ai-enrich/route.ts        AI explanation/difficulty/confidence enrichment endpoint
app/api/import-url/route.ts       URL readable-text extraction endpoint
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
- Added `npm run quality` as the architecture guardrail gate and wired it into `npm run check` before TypeScript/build/Phoenix tests.
- Extracted game helpers, game panels, dashboard cards, explore cards, study cards, builder workspace, source modals, study session panels, live presentation stage/status/dock components, and presentation editor panels.

## Current AI Builder Flow

AI is now part of the builder workflow, not a separate page.

- `/create` starts in `SourcePicker`, then routes into `BuilderWorkspace`.
- Supported starts: manual scratch, structured paste, AI from topic, AI from URL, and AI from document.
- AI generation options are shared through `AIGenerationOptions`: audience, difficulty preset, multiple-choice/true-false toggles, tone, and optional focus areas.
- `/api/ai-source-draft` validates source length, sends an env-configured provider request using `QUIZWORLD_AI_API_KEY`, `QUIZWORLD_AI_MODEL`, and optional `QUIZWORLD_AI_API_URL`, validates JSON, then removes near-duplicate questions.
- AI drafts include `question_type`, `difficulty`, `confidence`, `rationale`, `explanation`, answers, and citations. `lib/builder/question-factory.ts` maps those into builder questions.
- `/api/ai-enrich` can add missing explanations plus difficulty/confidence metadata to existing manually-created questions.
- URL import is protected against private/local hosts and caps fetch size. File import supports `.txt`, `.md`, `.pdf`, and `.docx`.

Current approximate route file sizes after cleanup:

```text
app/game/[pin]/page.tsx    ~909 lines, 17 inline styles
app/present/[code]/live/page.tsx ~431 lines, 0 route inline styles; 2 dynamic component styles
app/present/[code]/edit/page.tsx ~188 lines, 0 inline styles
app/create/page.tsx        ~492 lines, 0 inline styles
app/dashboard/page.tsx     ~444 lines, 20 inline styles
app/study/[id]/page.tsx    ~223 lines, 0 inline styles
app/study/page.tsx         ~249 lines, 30 inline styles
app/explore/page.tsx       ~549 lines, 46 inline styles
```

## Verification Baseline

Latest local gates after the 2026-05-14 AI/test/doc audit:

```bash
npm run quality
npm run typecheck
BASE_URL=http://localhost:3002 npx playwright test --reporter=line
```

Results:

- Quality guard passed: inline styles `488`, type escapes `40`, route file limits within current baseline.
- TypeScript passed.
- Local Playwright passed: `40/40`.
- Local browser run allows either configured Phoenix live-game screens or the explicit live-service configuration status when `NEXT_PUBLIC_GAME_SERVICE_URL` is absent.

Latest full build/service gate before this audit:

```bash
npm run check
```

Results:

- TypeScript passed.
- Next production build passed.
- Phoenix compile with warnings-as-errors passed.
- Phoenix tests passed: `29/29`.

Latest production/browser alignment check:

```bash
BASE_URL=https://www.quizworld.xyz npx playwright test --reporter=line
```

- Production Playwright passed `40/40` against the updated suite after deploy `dpl_G41cr5bN9UQFFjnSwv6RJDZNfJfW`.
- Production now includes the builder navigation test hook/markup and AI builder test/doc alignment changes.
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

Run `npm run quality` before and after cleanup work. The guard intentionally fails if inline styles, `any` usage, large route files, or duplicate Phoenix roots get worse.

Recommended order:

1. `app/explore/page.tsx` — move remaining filter/sort/header CSS/components. Low risk.
2. `app/study/page.tsx` — move remaining dashboard layout styles into CSS. Low risk.
3. `components/builder/BuilderWorkspace.tsx` — remaining properties-panel inline styles are still concentrated here. Medium risk because builder controls are heavily tested.
4. `app/game/[pin]/page.tsx` — only do further logic extraction with live host/player smoke tests. Higher risk.

Avoid broad rewrites. Prefer small PR-style extractions, then run the full gates above.

## Known Product/Ops Notes

- `www.quizworld.xyz` is the public production alias.
- As of 2026-05-14 20:29 UTC, production is aligned with the local workspace and updated docs/tests.
- Direct Vercel deployment URLs may show Vercel protection; use production aliases for public smoke.
- Phoenix backend: `https://quizworld-xs0g.onrender.com`.
- Local live game routes show `Live Game Service Not Configured` unless `NEXT_PUBLIC_GAME_SERVICE_URL` is present; this is expected.
- Present icon should remain `🎤`; Host icon is `🏁`; Join/player icon is `🎮`.
- There was a production test presentation created during smoke testing: `Phase 1 UI Smoke 2026-05-09`, id `1f6fa58f-4e43-4894-b608-3476297a6632`, join code `5506DD`.
- GitHub normal auth may fail; token URL push is the reliable path.
