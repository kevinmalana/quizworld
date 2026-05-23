# QuizWorld Full Audit Report
Date: 2026-05-23

---

## 🔴 Critical Bugs (breaks functionality)

### 1. `app/quiz/[id]/page.tsx` — Wrong column names queried from `profiles`
**File:** `app/quiz/[id]/page.tsx`, lines 28, 42–45  
**Severity:** High — creator avatar and level info silently missing on every quiz detail page.

**Problem A — `avatar_url` doesn't exist:**
```ts
.select("display_name, avatar_url, level, level_title, username")  // line 28
(profile as { avatar_url?: string } | null)?.avatar_url || "👤";  // line 42
```
The `profiles` table has a column named `avatar` — NOT `avatar_url`. Supabase returns `avatar_url` as `null`, so the creator avatar always renders as the fallback `👤` emoji on quiz detail pages, even when the creator has a real avatar set.

**Problem B — `level` and `level_title` don't exist:**
```ts
const creatorLevel = (profile as { level?: number } | null)?.level ?? null;  // line 43
const creatorLevelTitle = (profile as { level_title?: string } | null)?.level_title ?? null;  // 44-45
```
The `profiles` table has `total_xp` only — no pre-computed `level` or `level_title` columns. The explore page and leaderboard correctly call `calcLevel(total_xp)` to derive these. The quiz detail page never does this, so `creatorLevel` is always `null` and the level badge never renders.

**Fix:**
```ts
// Change the select to use the real column names:
.select("display_name, avatar, total_xp, username")
// Then:
const creatorAvatar = profile?.avatar || "👤";
const lv = calcLevel((profile as any)?.total_xp ?? 0);
const creatorLevel = lv.level;
const creatorLevelTitle = lv.title;
```

---

### 2. 74.9% of questions have zero answers in the `answers` table
**File:** Supabase DB — `questions` and `answers` tables  
**Severity:** Critical — these quizzes are unplayable in live game mode; study mode behaviour depends on how it handles missing answers.

**Data:**
- Total questions: 1,000
- Questions with at least one answer in `answers`: 251 (25.1%)
- Questions with **no** answers: **749 (74.9%)**
- Quizzes affected: **97 out of 160**

This likely means the seed/import script inserted questions but did not insert matching rows into the `answers` table for the majority of content. The game engine will either crash or show empty answer options during live play for ~97 quizzes.

---

### 3. 38 quizzes have zero questions
**File:** Supabase DB — `quizzes` and `questions` tables  
**Severity:** High — these quizzes appear on the explore page and can be hosted/studied, but contain no content.

**Count:** 38 out of 160 quizzes (23.75%) have 0 rows in `questions`.

Sample affected:
- `be94ff10` — "The Art Vault"
- `c0fbf0de` — "Safari Smarts"
- `b68ed3f2` — "Animation Nation"
- `3e441416` — "Stage Fright? Not Us!"
- (+ 34 others)

These quizzes are publicly visible and linked from the explore page ("Host" / "Study" buttons present), but clicking through will result in broken game sessions or empty study sessions.

---

### 4. Live game engine misconfigured — join/host show "Unavailable" error
**Files:** `lib/game-engine/config.ts`, `app/join/page.tsx`, `app/host/page.tsx`  
**Severity:** Critical — the game join flow is completely blocked in production unless `NEXT_PUBLIC_GAME_ENGINE` and `NEXT_PUBLIC_GAME_SERVICE_URL` are set.

**Problem:**
```ts
const rawEngine = process.env.NEXT_PUBLIC_GAME_ENGINE;         // undefined in .env.local
const gameEngine = rawEngine === 'supabase' ? 'supabase' : 'phoenix';  // defaults to "phoenix"
const liveGameEngineMisconfigured = gameEngine === 'phoenix' && gameServiceUrl.length === 0;  // TRUE
```

Since `.env.local` has neither `NEXT_PUBLIC_GAME_ENGINE` nor `NEXT_PUBLIC_GAME_SERVICE_URL`, `liveGameEngineMisconfigured` is `true`. Both `/join` and `/host` immediately render "Live Games Unavailable" panels instead of functional UI. The `/join` page shows the PIN entry form (since the flag check is inside `JoinForm`), but submitting any PIN will call `fetchPhoenixSession` against an empty URL.

**Fix:** Add to `.env.local` (and Vercel env vars):
```
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=https://<your-phoenix-game-service-url>
```
Or if Phoenix isn't deployed, switch to:
```
NEXT_PUBLIC_GAME_ENGINE=supabase
```

---

## 🟡 Medium Issues (bad UX, visual bugs)

### 5. Category mismatch — 15 DB categories have no emoji or color
**Files:** `lib/store.ts`, Supabase `quizzes.category`  
**Severity:** Medium — quizzes with these categories display fallback `📌` emoji and default purple color on the explore page instead of a meaningful icon.

**DB categories NOT in `CATEGORY_EMOJIS`/`CATEGORY_COLORS`:**
| DB Category | What renders |
|---|---|
| Animals | 📌 (fallback) |
| Anime & Manga | 📌 |
| Art | 📌 |
| Board Games | 📌 |
| Books | 📌 |
| Cartoons | 📌 |
| Comics | 📌 |
| Computers | 📌 |
| Gadgets & Tech | 📌 |
| Mathematics | 📌 |
| Musicals & Theatre | 📌 |
| Mythology | 📌 |
| Politics | 📌 |
| Television | 📌 |
| Vehicles | 📌 |

Additionally, the `SUPER_CATEGORIES` filter UI in `app/explore/page.tsx` (lines 36–104) uses store category names like `"Comics & Anime"`, `"TV Shows"`, `"Math"`, `"Politics & Government"` — but the database has `"Comics"`, `"Television"`, `"Mathematics"`, `"Politics"`. Filtering by these subcategories returns **zero results**.

**Fix:** Align `CATEGORY_EMOJIS`, `CATEGORY_COLORS`, and `SUPER_CATEGORIES` subcategory names with the actual values in the DB — or normalise DB values to match the store.

---

### 6. Explore page — `Collections` section uses fictional quiz counts
**File:** `app/explore/page.tsx`, lines 106–145  
**Severity:** Medium — UX lie; users click "Explore →" expecting 5–8 quizzes in a collection but get a category filter that may return 0–2 results.

The `COLLECTIONS` array is hardcoded with `quizCount: 5`, `quizCount: 8` etc. and `category: "Programming"` / `category: "Movies"`. The "Explore →" button sets `activeCategory` to the collection's category. But:
- `"Programming"` maps to a store category with zero DB quizzes
- `"Movies"` has only 1 DB quiz visible
- `"Geography"` has 2 quizzes

The quiz count badges ("5 quizzes", "8 quizzes") are completely fake — they don't query the DB.

---

### 7. `app/quiz/[id]/page.tsx` — "▶ Play Now" links to `/join` with no quiz pre-fill
**File:** `app/quiz/[id]/page.tsx`, lines 149, 205  
**Severity:** Medium — poor UX; user sees quiz detail and clicks "Play Now" but lands on a generic PIN entry screen with no connection to the quiz they were viewing.

```tsx
<Link href={`/join`} className="btn btn-primary">▶ Play Now</Link>
```

The quiz detail page has no "Host this quiz" button. On the explore card (`ExploreQuizCard`), there IS a `Host` link pointing to `/host?quiz=<id>`. The detail page should similarly offer `/host?quiz=${quiz.id}` or at minimum `/join` should pre-fill context. The current link drops all context.

---

### 8. Auth guards inconsistent — some routes show empty state instead of redirecting
**Severity:** Medium — inconsistent UX across protected routes.

| Route | Auth behaviour | Expected |
|---|---|---|
| `/dashboard` | Shows "Sign In Required" panel ✅ | ✅ |
| `/host` | Shows "Sign In to Host" panel ✅ | ✅ |
| `/create` | Allows editing, shows login prompt only on publish | ⚠️ Partial |
| `/profile` | Shows "Sign in to view your profile" inline | ⚠️ No redirect |
| `/achievements` | Renders empty achievements list; no sign-in prompt | ❌ |
| `/classrooms` | Shows "Sign in to use Classrooms" text (no redirect) | ⚠️ |
| `/groups` | No explicit auth check; shows public groups (join btn disabled) | ⚠️ |
| `/friends` | No redirect; renders empty list silently | ❌ |
| `/admin` | Shows "Sign in to access admin" inline panel | ⚠️ |

Routes `/achievements` and `/friends` give no feedback to unauthenticated users — they just silently render empty states, which looks like a bug or empty data rather than an auth wall.

---

### 9. Explore page quizzes duplicated across sections
**File:** `app/explore/page.tsx`  
**Severity:** Low-Medium — on a small dataset (24 quizzes), the same quiz appears in "🔥 Trending this week", "✨ New & Fresh", "🏆 All-Time Greatest", AND "All Quizzes" simultaneously. Confirmed in browser snapshot: "Debug Mode", "Toon Time", "Bon Appétit", "Final Boss Trivia" appear 3+ times on the page.

Trending sections currently have no deduplication logic; with only 24 public quizzes the overlap is 100%.

---

### 10. CSS preload warning on every page
**File:** `app/layout.tsx` or Next.js build config  
**Severity:** Low-Medium — performance/console noise  

Browser console on `/explore`, `/quiz/[id]`, `/join` all log:
```
The resource .../dafedd8935795f66.css was preloaded using link preload but not used within a few seconds
```
This is a stale CSS preload tag in the build output. Not a runtime crash but affects Lighthouse scores and clutters the console.

---

## 🟢 Minor Issues (polish)

### 11. `app/quiz/[id]/page.tsx` — Creator avatar rendered in `<span>`, not `<img>`
**File:** `app/quiz/[id]/page.tsx`, line 102  
```tsx
<span className="explore-quiz-creator-avatar">{creatorAvatar}</span>
```
The explore card (`ExploreQuizCard`) correctly conditionally renders `<img>` for URL-based avatars vs `<span>` for emoji avatars (lines 61–64 of `explore-quiz-card.tsx`). The quiz detail page always uses `<span>`, so if a creator's avatar is ever a URL it will render the raw URL string as text.

---

### 12. No "Host this quiz" button on quiz detail page
**File:** `app/quiz/[id]/page.tsx`  
The explore card has a "Host" link (`/host?quiz=<id>`). The detail page only has "▶ Play Now" (which goes to `/join`) and "📖 Study Mode". There's no way to directly host a specific quiz from its detail page without going back to explore.

---

### 13. `app/u/[username]/page.tsx` — Avatar rendered in `<div>` (not conditionally `<img>`)
**File:** `app/u/[username]/page.tsx`, line 132  
```tsx
<div className="u-profile-avatar">{profile.avatar || "👤"}</div>
```
Same pattern as #11 — URL avatars would render as raw text inside a div.

---

### 14. No `loading.tsx` files anywhere in `app/`
**Severity:** Minor — no streaming skeletons; users see blank/flash content during SSR.  
None of `app/loading.tsx`, `app/explore/loading.tsx`, etc. exist. Next.js App Router supports collocated `loading.tsx` for instant skeleton UIs during data fetching.

---

### 15. No `error.tsx` pages in route segments
**Severity:** Minor — unhandled server-side errors in RSC routes (e.g., `quiz/[id]`) will bubble up to the root ErrorBoundary or show a plain Next.js error page rather than a contextual fallback.

---

### 16. Study page (`app/study/[id]/page.tsx`) — no auth guard for XP award
**File:** `app/study/[id]/page.tsx`, line ~96  
```ts
if (!user || !quiz) { ... }
```
Study mode is accessible without login (by design), but XP is silently not awarded for unauthenticated sessions. There's no UI hint telling unauthenticated users that they should sign in to earn XP/streak. This is a missed engagement opportunity.

---

### 17. `app/explore/page.tsx` — `SUPER_CATEGORIES` filter uses store names, not DB names
**File:** `app/explore/page.tsx`, lines 36–104  
**Severity:** Medium-Minor (duplicated from #5 for clarity)  
Categories like `"TV Shows"` (store) vs `"Television"` (DB), `"Math"` vs `"Mathematics"`, `"Comics & Anime"` vs `"Comics"`, `"Politics & Government"` vs `"Politics"` mean the category filter chips return empty results for many subcategories even when matching quizzes exist.

---

## 📊 Data Issues

| Issue | Count | Impact |
|---|---|---|
| Quizzes with 0 questions | 38 / 160 (23.8%) | Unplayable/unstudyable |
| Questions with 0 answers | 749 / 1000 (74.9%) | Game engine crash during play |
| DB categories not in store | 15 categories | Broken emoji/color/filter |
| Store categories not in DB | 28 categories | Dead filter options |
| Orphaned questions (no parent quiz) | 0 | ✅ Clean |
| `leaderboard_weekly` view | ✅ Exists | Working |

**Root cause hypothesis:** The seeding/migration script created quiz shells and question rows, but the `answers` insert either ran against a wrong table schema, was silently skipped due to FK violations, or was truncated. The 38 zero-question quizzes may be a separate seeding step that also failed. These need a re-seed or manual data repair.

---

## 🔐 Auth/Security Issues

### 18. No server-side auth check on any route
All protected routes (`/dashboard`, `/host`, `/create`, `/profile`) use client-side auth via `useAuth()`. There are no `middleware.ts` redirects or server-side session checks. This means:
- SSR HTML for `/dashboard` is served to unauthenticated users (it just renders a loading state, then redirects client-side)
- No SEO risk since pages are mostly client-rendered
- Acceptable for this app type, but worth noting for future hardening

### 19. `SUPABASE_SERVICE_ROLE_KEY` is present in `.env.local`
This is only safe if the key is not included in the client bundle (i.e., it doesn't have `NEXT_PUBLIC_` prefix). Confirmed: it is server-only. ✅ No issue — but worth double-checking that no client-side code imports it.

### 20. `/admin` route — checks `is_admin` from DB after auth, but no redirect
**File:** `app/admin/page.tsx`, lines 70-71  
Non-admin users who are signed in see "Sign in to access admin" (which is confusing since they ARE signed in), rather than "You don't have permission". The check fetches the profile and checks `is_admin`, but the error message is wrong.

---

## 📱 Mobile Issues

### 21. `styles/explore.css` — No `@media` queries at all
**File:** `styles/explore.css` (272 lines, 0 media queries)  
The explore page grid and card layout relies entirely on globals CSS utility classes (`grid-2`, `grid-3`, etc. from `globals.css`). The trending row section in `app/explore/page.tsx` uses inline `gridTemplateColumns: "repeat(3, 1fr)"` with no responsive override. On small screens, cards will be squished into 3 narrow columns.

### 22. `styles/dashboard.css` — No `@media` queries
**File:** `styles/dashboard.css` (223 lines, 0 media queries)  
Dashboard metric grid and quiz cards have no mobile-specific layout adjustments in their dedicated stylesheet.

### 23. `styles/game.css` — Only 2 `@media` breakpoints
**File:** `styles/game.css` (941 lines, 2 breakpoints)  
Breakpoints at `max-width: 480px` only (lines 56, 921). No tablet (768px) breakpoints. The game UI may look awkward on mid-size devices.

### 24. Trending row hard-codes 3-column grid without CSS class
**File:** `app/explore/page.tsx`, ~line 370  
```tsx
style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", ... }}
```
This inline style has no media query override. It references className `"trending-row-scroll"` which presumably exists in `explore.css` — but explore.css has zero media queries, so there's no responsive behaviour for this row.

---

## ✅ What's Working Well

1. **404 handling** — `app/not-found.tsx` exists and is clean with good CTAs.
2. **Quiz detail invalid ID** — `if (!quiz) notFound()` correctly triggers Next.js 404 (line 22, `app/quiz/[id]/page.tsx`).
3. **Error boundary** — Root-level `ErrorBoundary` in `app/layout.tsx` catches React errors gracefully.
4. **Explore empty states** — Loading, error, no-results, and truly-empty states all handled (lines 795–835).
5. **Join page PIN validation** — Invalid PIN shows "Game not found. Check the PIN and try again." ✅
6. **Creator avatar in explore cards** — `ExploreQuizCard` correctly handles both URL and emoji avatars with conditional `<img>` rendering.
7. **Leaderboard** — `leaderboard_weekly` view exists; global and weekly tabs both functional; uses `calcLevel(total_xp)` correctly.
8. **No orphaned questions** — All 1000 questions have a valid parent quiz.
9. **Post-login redirect flow** — `sessionStorage.setItem("qw_post_login_redirect", ...)` is set before redirecting to `/login` in host, create, and join pages.
10. **Dashboard auth** — Properly shows "Sign In Required" panel with link to `/login`.
11. **`calcLevel()` centralised** — Level calculation is DRY, sourced from `components/study/study-session-panels.tsx`, used consistently in leaderboard, profile, explore.
12. **`quiz/[id]` public-only filter** — `.eq("is_public", true)` ensures private quizzes are not accessible via direct URL.

---

## 🗺️ Recommended Fix Priority

| Priority | Issue | Effort |
|---|---|---|
| P0 | #2 — Seed answers for 749 questions | High (data repair) |
| P0 | #3 — Seed questions for 38 empty quizzes | High (data repair) |
| P0 | #4 — Set `NEXT_PUBLIC_GAME_ENGINE` + `NEXT_PUBLIC_GAME_SERVICE_URL` in prod | Low (env var) |
| P1 | #1 — Fix `avatar_url` → `avatar`, add `calcLevel(total_xp)` in quiz detail | Low (code fix) |
| P1 | #5/#17 — Align DB categories with store / fix SUPER_CATEGORIES filter | Medium |
| P2 | #7 — Add "Host this quiz" button to quiz detail page | Low |
| P2 | #6 — Fix fake collection quiz counts or make them dynamic | Medium |
| P3 | #9 — Deduplicate quizzes across trending sections | Low |
| P3 | #8 — Add explicit sign-in prompts to `/achievements` and `/friends` | Low |
| P3 | #11/#13 — Conditional `<img>` vs `<span>` for URL avatars | Low |
| P4 | #21–24 — Mobile CSS breakpoints for explore/dashboard | Medium |
| P4 | #14–15 — Add `loading.tsx` and `error.tsx` files | Low |
| P4 | #10 — Fix CSS preload warning | Low |
