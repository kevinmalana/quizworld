# QuizWorld Audit Fix Plan — 2026-08-13

## Created: 2026-08-13T16:36:45.583228Z

## Phases (priority order)

### 1 — security
Items: `fix-01, fix-02, fix-03, fix-12`

### 2 — perf & scaling
Items: `fix-04, fix-05, fix-06`

### 3 — reliability
Items: `fix-07, fix-08`

### 4 — UX
Items: `fix-09, fix-10, fix-13, fix-14`

### 5 — hardening
Items: `fix-11, fix-15`

---
## Items

### fix-01: Lock down game_results RLS + secure /report route [CRITICAL]
**Files:** `supabase/migrations/20260813_restore_host_only_results.sql (new)`, `app/report/[pin]/page.tsx`, `app/api/reports/[pin]/route.ts (new)`

**Goal:** Restore `auth.uid() = host_id` SELECT policy on game_results; add server-side /api/reports/[pin] route that gates via Supabase auth session.

**Steps:**
- 1. Create migration that DROPs `game_results public read` and recreates `game_results read own host results`.
- 2. Create migration that DROPs `players public read` and `player_answers public read` — recreate with host-only or member-of-game policies.
- 3. If /report page still needs SOME public-readable data (e.g., post-game recap that's shareable), design and add a separate `game_recaps` table with public SELECT.
- 4. Add `app/api/reports/[pin]/route.ts` that uses `createServerClient` + checks session.user.id matches game_results.host_id.
- 5. Refactor `app/report/[pin]/page.tsx` to call `/api/reports/[pin]` instead of direct supabase.

**Verify:**
- Anon user with valid PIN → /api/reports/[pin] returns 403.
- Host user → 200 with full report.
- Non-host authed user → 403.
- Run npm run typecheck + npm run build.

### fix-02: Add auth + rate-limit to /api/present/import-deck [CRITICAL]
**Files:** `app/api/present/import-deck/route.ts`

**Goal:** Require Supabase auth + apply same rate-limit used in /api/ai-source-draft + cap upload size.

**Steps:**
- 1. Add `checkRateLimit` call (15/min per user).
- 2. Add `auth.getSession()` check (mirror import-pdf pattern).
- 3. Reduce MAX_SIZE to 25MB.
- 4. Sanitize filename before EXEC to LibreOffice (it's passed as a path argument so already safe, but check).
- 5. Add `randomize input filename` to avoid path-traversal paranoia.
- 6. Limit conversion timeout to 30s (down from 60s) to free workers faster.

**Verify:**
- Anon POST → 401.
- Logged-in POST → 200 with file or 400 with error.
- Rate-limit fires after 15 in 60s.

### fix-03: Add auth + rate-limit to all writes on /api/import-pdf (defensive) [HIGH]
**Files:** `app/api/present/import-pdf/route.ts`

**Goal:** Add `checkRateLimit` to /api/present/import-pdf so spamming PDFs is bounded.

**Steps:**
- 1. Add `checkRateLimit(request, { maxRequests: 10, windowMs: 60_000 })`.

**Verify:**
- Anon POST → 401.
- Logged-in 10th POST within 60s → 429.

### fix-04: Limit /study to bounded query (200 items + pagination) [HIGH]
**Files:** `app/study/page.tsx`

**Goal:** Stop loading the entire catalog; cap at 200 most-recent with a 'load more' flow.

**Steps:**
- 1. Add `.limit(200)` to quizQuery.
- 2. If returned == 200, show a `Load more` button that fetches the next page (cursor-based on created_at).
- 3. Show count label 'Showing 200 latest — Load more for older'.

**Verify:**
- Visit /study with mock 5000 quizzes in DB → only 200 fetched.
- Type-check + build clean.

### fix-05: Limit /admin/loadAll() to bounded queries [HIGH]
**Files:** `app/admin/page.tsx`

**Goal:** Cap quiz/profile queries to 500 most-recent.

**Steps:**
- 1. Add `.limit(500)` to both profiles and quizzes queries.
- 2. Show counts in UI ('showing 500 most recent of N total') if count > 500.
- 3. Add 'Most played' and 'Search by username/title' tabs to navigate within the cap.

**Verify:**
- Visual: numbers don't go off the rails with 5000 quizzes.

### fix-06: Add 9 missing database indexes [HIGH]
**Files:** `supabase/migrations/20260813_add_indexes.sql (new)`

**Goal:** Speed up /dashboard, /explore, /report, /join, /classrooms.

**Steps:**
- 1. Write migration with 8 indexes (see Part B recommendation).
- 2. Apply via Supabase SQL editor (or use mcp__supabase__apply_migration).
- 3. Verify via EXPLAIN ANALYZE before/after on key queries.

**Verify:**
- EXPLAIN on /explore main query: Index Scan using idx_quizzes_plays_desc.
- EXPLAIN on /join RPC: Index Scan using idx_game_sessions_pin.

### fix-07: Fix Map.fetch! crash in Phoenix reveal_current_question [MEDIUM]
**Files:** `services/quizworld_realtime/lib/quizworld_realtime/game.ex`

**Goal:** When a question has no is_correct answer, return {:error, :no_correct_answer} instead of crashing the GenServer.

**Steps:**
- 1. Replace `Map.fetch!("id")` with case statement returning {:error, :no_correct_answer} on nil.
- 2. Update caller (game_server.ex) to ignore {:error, :no_correct_answer} and keep current state.
- 3. Add log warning for visibility.

**Verify:**
- Local mix test: malformed question data doesn't crash.
- Compiles with --warnings-as-errors.

### fix-08: Add Phoenix task supervision for result_sync [MEDIUM]
**Files:** `services/quizworld_realtime/lib/quizworld_realtime/application.ex`, `services/quizworld_realtime/lib/quizworld_realtime/result_sync.ex`

**Goal:** Replace `Task.start/1` with `Task.Supervisor.async_nolink` so failures are visible + can be retried.

**Steps:**
- 1. Add Task.Supervisor to children() in application.ex.
- 2. Add ResultSync.persist/2 that does the same work but raises on persistent failure.
- 3. Switch game_server.ex sync_finished_game to use Task.Supervisor with proper supervisor name.
- 4. Optional: add retry with exponential backoff.
- 5. Add a Prometheus counter / Logger metric for sync_success/failure.

**Verify:**
- mix test still passes.
- Supabase outage simulation: task visible in supervisor; retry on recovery.

### fix-09: Mobile PIN digit duplication fix in /join [MEDIUM]
**Files:** `app/join/page.tsx`

**Goal:** Stop mobile autocorrect/swipe-typing from producing duplicate digits.

**Steps:**
- 1. Replace handleDigitChange with onInput + always-clear-on-render.
- 2. Add a hidden single-input fallback OR a robust multi-cell that handles paste.
- 3. Use inputMode='numeric' but allow alphanumeric.
- 4. Test on iOS Safari + Android Chrome.

**Verify:**
- Type 'ABC123' on mobile → produces ["A","B","C","1","2","3"] only.
- No duplicates.

### fix-10: Server-side /explore category filter [MEDIUM]
**Files:** `app/explore/page.tsx`

**Goal:** Make category filter actually filter, with pagination preserved.

**Steps:**
- 1. Move activeCategory into the fetchPage query.
- 2. Use `useEffect` deps including `[activeCategory, sortMode]`.
- 3. Reset page=0 on category change.
- 4. If category+search yields 0 results on server, show empty state.

**Verify:**
- Visit /explore, select 'Mathematics' → returns ONLY math quizzes.
- Pagination works within filtered category.

### fix-11: Add CSP header via next.config + Vercel edge [MEDIUM]
**Files:** `next.config.mjs`, `vercel.json`

**Goal:** Set Content-Security-Policy at the response level.

**Steps:**
- 1. Add CSP header in next.config.mjs (frame-src 'self', script-src 'self' 'unsafe-inline', etc.).
- 2. Test with curl -sI https://www.quizworld.xyz after deploy.
- 3. Be careful not to break Supabase WebSocket connections or auth callbacks.

**Verify:**
- curl -sI shows Content-Security-Policy header.
- App doesn't break in browser.

### fix-12: Add E2E tests for game_results RLS + import-deck auth [MEDIUM]
**Files:** `e2e/security.spec.ts`, `e2e/security-extra.spec.ts (new)`

**Goal:** Lock in the fixes from fix-01 and fix-02 with regression tests.

**Steps:**
- 1. Add 4 new test.describe blocks: game_results RLS, player_answers RLS, /report anon access, /api/present/import-deck auth.
- 2. Run the full suite.

**Verify:**
- All new tests pass.
- Existing tests still pass.

**Depends on:** fix-01, fix-02

### fix-13: Increase host-session TTL + age indicator + add ad-hoc helpers [LOW]
**Files:** `lib/host-session.ts`, `lib/host-session-age.ts (new)`, `app/game/[pin]/page.tsx`

**Goal:** 12h TTL for long classroom sessions; show the host how long their session has been live.

**Steps:**
- 1. Change HOST_SESSION_TTL_MS to 12h.
- 2. Add a helper that returns session age from sessionStorage timestamp.
- 3. In host panel, show 'Live for Xh Ym' badge.
- 4. Add renew-on-action: rewrite sessionStorage on each successful reveal/advance.

**Verify:**
- Visual: time-since-launch visible in host UI.
- Long classroom scenario: session survives 6h.

### fix-14: Sign-in CTA when AI endpoints 401 + fix opaque error [LOW]
**Files:** `app/create/page.tsx`

**Goal:** If user not logged in, AI generation should show a clear 'Sign in to use AI quiz generation' prompt instead of 'AI generation failed'.

**Steps:**
- 1. Pre-check `user?.id` before calling /api/ai-source-draft.
- 2. If null, show sign-in CTA inline.
- 3. Server-side keep 401 as-is (defense-in-depth).

**Verify:**
- Logged-out user clicks Generate → 'Sign in' button visible.
- Logged-in user → existing flow.

### fix-15: Add /api/ai-game-insights to rate limit [LOW]
**Files:** `lib/rate-limit.ts`

**Goal:** Cap /api/ai-game-insights at 10/min per user.

**Steps:**
- 1. Add `{ maxRequests: 10, windowMs: 60_000 }` to ROUTE_LIMITS for /api/ai-game-insights.

**Verify:**
- 11th call within 60s → 429.
