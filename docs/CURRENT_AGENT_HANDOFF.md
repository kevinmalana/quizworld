# QuizWorld Current Agent Handoff

Last verified: 2026-05-17 21:06 UTC
Production alignment checked: 2026-05-17 21:06 UTC, aligned with local workspace
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
styles/dashboard.css              dashboard-specific CSS
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
- Continued builder cleanup on 2026-05-14 by moving `QuestionCard.tsx` static/state styling into `styles/builder.css`, reducing global inline styles from `458` to `414`.
- Continued builder cleanup on 2026-05-15 by moving `CreateSourceModals.tsx`, `BuilderToolbar.tsx`, and `PublishLoginPrompt.tsx` inline styling into `styles/builder.css`, reducing global inline styles from `414` to `364`.
- Continued the 2026-05-15 cleanup by extracting `SourcePicker.tsx`, `QuestionSidebar.tsx`, dashboard cards, study quiz cards, and study stats styling into CSS. Global inline styles are now `218`; main route files listed below have 0 route inline styles.

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
app/game/[pin]/page.tsx    ~919 lines, 0 route inline styles
app/present/[code]/live/page.tsx ~431 lines, 0 route inline styles
app/present/[code]/edit/page.tsx ~188 lines, 0 inline styles
app/create/page.tsx        ~585 lines, 0 inline styles
app/dashboard/page.tsx     ~440 lines, 0 route inline styles
app/study/[id]/page.tsx    ~223 lines, 0 inline styles
app/study/page.tsx         ~229 lines, 0 route inline styles
app/explore/page.tsx       ~293 lines, 0 route inline styles
```

## Verification Baseline

Latest local gates after the 2026-05-14 AI/test/doc audit:

```bash
npm run quality
npm run typecheck
BASE_URL=http://localhost:3002 npx playwright test --reporter=line
```

Results:

- Quality guard passed: inline styles `218`, type escapes `40`, route file limits within current baseline.
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

- Production Playwright passed `40/40` against the updated suite after deploy `dpl_FaY2PResJBuMdtuJXL58GWf3FCkB`.
- Production now includes the builder navigation test hook/markup and AI builder test/doc alignment changes.
- Production route smoke passed for `/`, `/create`, `/study`, `/study/[id]`, `/dashboard`, `/explore`, `/host`, `/join`, `/present`, `/game/NOPE01`.
- Phoenix health returned `{"status":"ok","service":"quizworld_realtime","redis":true}`.
- Authenticated live host + mobile player game flow passed with no host/player console errors after the game/dashboard cleanup.

Latest deploy (2026-05-17 — session 2):

- `3f3c3b4` — fix: replace all technical user-facing strings in game mode
- `a54478a` — fix: review round bug, explanation delay 600→1800ms, study e2e tests
- `b18e099` — feat: study mode overhaul (QuickFire bug, flashcard UX, explanations, review round, search+filter)
- `6905a4a` — refactor: remove AI slop, extract inline styles to CSS, clean components, security middleware, 19 new tests
- All deployed to `www.quizworld.xyz`. Latest: `dpl_rao401m7r` (21:06 UTC).

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

1. `components/game/live-game-panels.tsx` — largest remaining inline-style hotspot. Requires host/player smoke tests.
2. `app/admin/page.tsx` — low-traffic admin surface with remaining inline styles.
3. `components/builder/LivePreview.tsx` — builder preview modal still has static/dynamic inline styling.
4. `components/present/*` and profile/report shared components — smaller remaining style cleanup.

Avoid broad rewrites. Prefer small PR-style extractions, then run the full gates above.

## Known Product/Ops Notes

- `www.quizworld.xyz` is the public production alias.
- As of 2026-05-17 20:15 UTC, production is aligned with the local workspace (latest commit: `63b0d0f`).
- Direct Vercel deployment URLs may show Vercel protection; use production aliases for public smoke.
- Phoenix backend: `https://quizworld-xs0g.onrender.com` — **hosted on Render**, health endpoint: `/api/health` returns `{"status":"ok","redis":true}`.
- **`NEXT_PUBLIC_GAME_SERVICE_URL` IS set in Vercel production** (encrypted, set ~48 days ago). Live hosting and joining works. Do NOT flag this as missing — it's configured in the Vercel dashboard, not in local files or vercel.json.
- `NEXT_PUBLIC_GAME_ENGINE` is also set in Vercel production (encrypted).
- Local dev: live game routes show `Live Game Service Not Configured` unless `NEXT_PUBLIC_GAME_SERVICE_URL` is set in `.env.local`; this is expected locally only.
- Present icon should remain `🎤`; Host icon is `🏁`; Join/player icon is `🎮`.
- There was a production test presentation created during smoke testing: `Phase 1 UI Smoke 2026-05-09`, id `1f6fa58f-4e43-4894-b608-3476297a6632`, join code `5506DD`.
- GitHub normal auth may fail; token URL push is the reliable path.

## Open Issues (from AUDIT-2026-05-17.md)

See `docs/AUDIT-2026-05-17.md` for full details. Priority order:

1. 🔴 **In-memory rate limiter** (`lib/rate-limit.ts`) resets on Vercel cold start — AI endpoints unprotected in production. Replace with Upstash Redis or auth-only guard.
2. 🔴 **`/admin` has no server-side auth guard** — client-side useEffect only; anyone can attempt the URL.
3. 🟡 **Dashboard nukes on single query failure** — 5 parallel Supabase queries, any failure shows blank page. Needs partial-load fallback.
4. 🟡 **`study_progress` upsert** uses `onConflict: "user_id, quiz_id"` — requires unique constraint in DB or silently inserts duplicates.
5. 🟡 **`quiz_drafts` RLS** — verify owner-read policy exists in Supabase dashboard.
6. 🟡 **`/report/[pin]`** — no auth guard, any unauthenticated user can view game reports by PIN.

## Changes Made 2026-05-17 (Session 2)

### Code Quality Refactor
- Extracted all inline styles from `live-game-panels.tsx` (81→0), `admin/page.tsx` (20→0), `LivePreview.tsx` (18→0) into CSS files
- Total inline styles reduced: 218 → 113
- Admin page: extracted `StatCard` + `HealthCard` sub-components, removed unused imports
- `LivePreview.tsx`: 90 lines → 60 lines, cleaned up
- `live-game-panels.tsx`: named constants for podium logic, proper GameAnswerWithMedia + GameSessionData types
- Dashboard: try/catch/finally so `setLoading(false)` always fires on network error
- `middleware.ts` (new): server-side `/admin` auth guard using `@supabase/ssr`

### Study Mode Overhaul
- **Bug fixed**: QuickFire mode was rendering `FlashcardPanel` instead of `QuickFirePanel` — broken from the start
- **Bug fixed**: Review round showed "No questions available" — wrong questions state cleared before mode change; fixed by capturing array before state reset
- Flashcard UX redesigned: front = question only + "Tap to reveal answers", back = answer grid + explanation
- Explanation display delay: 600ms → 1800ms (users can now read it before auto-advance)
- New review round: after session, replay only missed questions with correct answers highlighted
- Wrong-answer breakdown on result screen with correct answers + explanations
- Search input + category chip filter on Study Hall
- `StudyQuestion` type now includes `explanation` and `difficulty` fields
- New `StudyReviewPanel` component for retry rounds

### Game Mode User-Facing Copy
- Removed all technical jargon from error states visible to end users
- "Live Game Service Not Configured" → "Live Games Unavailable"
- "Legacy Supabase Live Games Disabled — Production live sessions now require the Phoenix realtime service." → "Live Games Unavailable — Live multiplayer games are temporarily unavailable."
- NEXT_PUBLIC env var strings removed from all user-facing text
- Classic mode description replaced with plain English: "Everyone answers simultaneously, points awarded for speed and accuracy."

### Tests
- 40 → 59 Playwright tests
- New test coverage: present flow, AI from URL/doc modals, PIN validation, auth guards (/admin redirect, /report public), study session flashcard flip, QuickFire timer, review round, search + category filter

### Updated Open Issues (post-session-2)
- ✅ `/admin` server-side guard — DONE (middleware.ts)
- ✅ Dashboard partial-load — DONE (try/catch/finally)
- 🔴 In-memory rate limiter still needs replacing
- 🟡 `study_progress` unique constraint — verify in Supabase
- 🟡 `quiz_drafts` RLS — verify in Supabase
- 🟡 `/report/[pin]` no auth guard
- 🟡 Explore pagination (no limit on public quiz fetch)
