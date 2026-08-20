# QuizWorld Security and UX Recovery Implementation Plan

> **For Hermes:** Implement task-by-task with strict RED→GREEN→REFACTOR, focused commits, independent code review, preview verification, and production deployment only after all gates pass.

**Goal:** Remove confirmed production privacy/data-integrity defects, restore reliable quiz/game/classroom/presentation workflows, and ship the highest-leverage competitive creation improvements.

**Architecture:** Make Phoenix the deep audience-facing presentation module: browser clients receive token/role-sanitized snapshots and activity through Phoenix rather than reading Supabase presentation tables directly. Keep Supabase as durable owner/service-role storage with RLS. Consolidate quiz validation/persistence, authentication continuation, XP calculations, and catalog pagination into shared modules so UI and persistence use one contract.

**Tech Stack:** Next.js/React/TypeScript, Phoenix/Elixir, Redis, Supabase/Postgres/RLS, Playwright, Node test runner, GitHub Actions, Vercel, Render.

---

## Safety and release rules

- Branch from exact production `main` SHA `efa1232d6ade3b37fa8f1bc1b891ed44fc330da3`.
- Never expose or print participant names, response bodies, answer values, tokens, service keys, or connection strings during verification.
- Every defect fix begins with a focused failing test.
- Database changes are migration-only, additive where possible, idempotent, and dry-run before production.
- Preview deploy and CI must pass before merge.
- Production order: compatible database migration → Phoenix backend → frontend → live security/workflow probes.
- Verify anonymous reads of `slides`, `slide_responses`, and `qna_questions` are denied after rollout.

## Phase 0 — Presentation containment and authority

### Task 1: Add security regression probes

**Files**
- Create: `e2e/presentation-security.spec.ts`
- Modify: `e2e/presentation-channel.spec.ts`
- Test: `services/quizworld_realtime/test/quizworld_realtime/presentations_test.exs`

**Tests first**
- Anonymous REST cannot select slides, responses, or Q&A.
- Participant snapshots never contain `is_correct`, including nested `content.interactive.answers`.
- Response activity remains available when Q&A has no rows.
- Hide/reveal state is broadcast and honored by participant clients.
- Each presentation run reads only its own responses.

### Task 2: Create compatible presentation migration

**File**
- Create: `supabase/migrations/20260820121000_secure_presentation_activity.sql`

**Schema/RLS**
- Ensure `qna_questions` and `qna_question_upvotes` exist before dependent objects.
- Add run/session reference to responses and Q&A while preserving existing rows.
- Add indexes for current-run activity.
- Drop anonymous/public SELECT/UPDATE policies from slides, responses and Q&A.
- Add owner-only slide reads and no-direct-client activity access; Phoenix service role remains storage adapter.
- Preserve existing data; no destructive deletion.

### Task 3: Deepen Phoenix presentation authority

**Files**
- Modify: `services/quizworld_realtime/lib/quizworld_realtime/presentations.ex`
- Modify: `services/quizworld_realtime/lib/quizworld_realtime/presentation_store.ex`
- Modify: `services/quizworld_realtime/lib/quizworld_realtime_web/channels/presentation_channel.ex`
- Modify: `services/quizworld_realtime/lib/quizworld_realtime_web/controllers/presentation_controller.ex`

**Behavior**
- Return and cache a live-run identifier.
- Scope activity cache and durable queries by run.
- Recursively strip answer keys for participant/viewer snapshots.
- Store/broadcast server-authoritative reveal/results-hidden state.
- Treat absent Q&A rows as an empty list; table/API errors remain explicit.
- Filter every event by presentation, run and slide.

### Task 4: Remove direct browser presentation reads

**Files**
- Modify: `app/present/[code]/live/page.tsx`
- Modify: `lib/presentation/client.ts`
- Modify: `lib/presentation/presentation-socket.ts`
- Modify: `components/present/live/live-slide-stage.tsx`

**Behavior**
- Load live snapshots through Phoenix.
- Use presenter/participant authorization for activity.
- Clear stale slide activity before fetching the next slide and ignore late responses.
- Honor server result visibility.
- Add explicit completion/ended state rather than redirecting everyone to authoring.

## Phase 1 — Core data-loss and blocked-workflow repairs

### Task 5: Repair presentation editor

**Files**
- Modify: `app/present/[code]/edit/page.tsx`
- Modify: `components/present/edit/add-slide-modal.tsx`
- Modify: `components/present/edit/import-deck-panel.tsx`
- Modify: `components/present/edit/slide-preview.tsx`
- Modify: `components/present/edit/slide-editor-panel.tsx`
- Modify: `styles/present.css`
- Test: new authenticated editor Playwright coverage

**Behavior**
- Mount Add Slide and Import modals.
- Validate standalone and nested interactive overlays through one shared validator.
- Reuse audience renderer for accurate preview without revealing answers.
- Add debounced auto-save, dirty/saving/saved/error states and unload guard.
- Add launch busy/error states.
- Use one 25 MB import limit across client/server.
- Stack mobile create controls and target current rendered panel classes.

### Task 6: Repair quiz management and persistence

**Files**
- Modify: `app/create/page.tsx`
- Modify: `components/dashboard/dashboard-cards.tsx`
- Modify: `lib/builder/question-factory.ts`
- Modify: `lib/quiz-drafts.ts`
- Modify: `components/builder/CreateSourceModals.tsx`
- Modify/create Supabase save-draft RPC migration
- Test: dashboard/draft/publish lifecycle Playwright and unit tests

**Behavior**
- Implement `draft`, `version`, and `duplicate` query semantics; duplicate never sets source edit ID.
- Use one validation result for UI, payload and RPC.
- Block publish or explicitly confirm incomplete-question removal; never silently discard.
- Save the complete quiz model transactionally; include type/media/video/shuffle/timing/points/explanations/visibility.
- Mark generated/imported/add/delete/duplicate operations dirty.
- Use source-grounded document mode and preserve AI confidence/citations for review.
- Make source dialogs responsive, semantic, focus-trapped and Escape-closeable.

## Phase 2 — Study, game, reporting and social correctness

### Task 7: Centralize study/game scoring and timing

**Files**
- Modify: `app/study/[id]/StudyPageClient.tsx`
- Modify: `components/study/study-session-panels.tsx`
- Modify: `app/leaderboard/page.tsx`
- Modify: `components/game/GameFinishedPanel.tsx`
- Create shared score/XP helpers and unit tests

**Behavior**
- Introduce explicit QuickFire timer-ready state.
- Use one XP calculator for display and persistence.
- Use weekly XP consistently in weekly podium/rows.
- Share the current player’s score, not the winner’s.
- Keep explanations visible long enough and keyboard-accessible.

### Task 8: Persist multiplayer readiness and report detail

**Files**
- Modify Phoenix game session/state/channel modules and tests.
- Modify `app/game/[pin]/page.tsx` and `components/game/WaitingLobbyPanel.tsx`.
- Modify game-finish persistence/reporting helpers.

**Behavior**
- Broadcast ready state through Phoenix presence/session state.
- Persist question history and per-response breakdown atomically at finish.
- Add active-game reconnect recovery instead of unrecoverable spectator-only fallback where token refresh is safe.

### Task 9: Repair classrooms, notifications and groups

**Files**
- Modify: `app/classrooms/[id]/page.tsx`
- Modify: `components/shared/notification-bell.tsx`
- Modify: `app/groups/page.tsx`
- Modify: `app/classrooms/page.tsx`
- Add notification migration/helper if no compatible table exists.

**Behavior**
- Persist classroom nudges before showing success; report failures/partial delivery.
- Compute insights from fetched assignments, not stale React state.
- Auto-complete assignments from verified study completion; label manual override.
- Fetch private memberships independently from public discovery.
- Add consistent signed-out CTAs.

## Phase 3 — Product UX and competitive creation

### Task 10: Authentication, visual system and accessibility

- Centralize validated `next` redirect handling for email/OAuth.
- Add password recovery and separate success/error statuses.
- Self-host fonts or update CSP without external runtime errors.
- Make cookie notice non-obstructive.
- Enforce 44×44 targets, `:focus-visible`, semantic headings and flashcard keyboard controls.

### Task 11: Discovery and study catalog

- Server-side search/count and cursor pagination.
- Continue/Assigned/Recommended sections before the catalog.
- Deduplicate Explore feature rows from the main grid.
- Display truthful total/loaded counts.
- Canonical category + alias/tag mapping and migration.

### Task 12: Unified creation and AI presentation

**Initial vertical slice**
- Add one creation launcher for Quiz, Presentation and Study Set.
- Accept topic/document/URL/deck/template as shared source choices.
- Generate a presentation outline and editable slides from topic/document.
- Convert selected quiz questions into interactive presentation slides.
- Preserve existing blank/import paths.

**Likely files**
- Create: `app/create/activity/page.tsx` or shared launcher under `components/create/`
- Create: `app/api/ai-presentation-draft/route.ts`
- Create: `lib/presentation/ai-draft.ts`
- Modify: `app/present/page.tsx`, `app/create/page.tsx`, navigation and presentation editor
- Test: unit validation plus authenticated source→draft→save→present Playwright flow

## Verification gates

Run after each vertical slice:

```bash
npm run typecheck
npm run test:unit
npm run check:phoenix
```

Before PR:

```bash
npm run check
npm run build
npx playwright test --project=chromium
mix test
```

Release validation:

- Git diff/security review.
- GitHub CI green.
- Vercel preview READY at exact branch SHA.
- Supabase migration dry-run reviewed from generated SQL/diff.
- Production migration applied before dependent code.
- Backend health/Redis/WebSocket probes pass.
- Anonymous presentation table reads denied.
- Two-browser presenter/participant tests pass for every interaction type.
- QuickFire starts at question 1 with positive timer and zero attempts.
- Dashboard Continue/Open Snapshot/Duplicate behave correctly.
- Private group survives reload; classroom nudge appears in recipient notification UI.
- Production frontend SHA equals merged main SHA.

## Commit/PR structure

1. `test: capture presentation security regressions`
2. `fix: secure presentation activity and live authority`
3. `fix: restore presentation authoring lifecycle`
4. `fix: make quiz drafts and dashboard actions reliable`
5. `fix: correct study game and reporting state`
6. `fix: restore classroom and social trust`
7. `feat: unify activity creation and presentation generation`
8. `test: add authenticated multi-client workflow coverage`

Use one release PR unless migration/backend/frontend compatibility requires a temporary two-PR rollout. Do not merge until all applicable gates are green.