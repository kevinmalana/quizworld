# QuizWorld User Flow Audit Report
**Date:** 2026-05-31  
**Auditor:** James (OpenClaw)  
**Scope:** Full codebase + live site

---

## Summary

| Severity | Count |
|---|---|
| P0 (flow completely broken) | 5 |
| P1 (significant degradation) | 9 |
| P2 (minor/cosmetic) | 7 |
| **Total** | **21** |

---

## P0 — Flow Completely Broken

### BUG-001: Google OAuth ignores post-login redirect
**Flow:** Auth — Google Sign In  
**File:** `app/login/page.tsx:49`, `app/auth/callback/route.ts:7`  
**Description:** When a user comes from `/host` or `/create` and clicks "Sign in with Google", `sessionStorage.setItem("qw_post_login_redirect", "/host")` is set. But the OAuth `redirectTo` is `${origin}/auth/callback` with no `?next=` param. The callback route (`app/auth/callback/route.ts`) reads `next` from URL params (defaults to `/dashboard`) — it never reads `sessionStorage`. So Google OAuth always lands on `/dashboard` regardless of where the user came from.  
**Reproduction:** Go to `/host` while logged out → click "Sign In" button → choose Google → you land on `/dashboard` not `/host`  
**Fix:** Pass `redirectTo: ${origin}/auth/callback?next=/host` with the encoded next path in `handleGoogleSignIn`. Read `next` param in callback route (already does this, just need to pass it).

---

### BUG-002: /signup route 404
**Flow:** Auth — Sign Up  
**File:** No `app/signup/` directory exists  
**Description:** There is no `/signup` page. The login page has no "Create Account" or "Sign Up" link. New users have no obvious way to register — they can only discover that Supabase allows email signup via the login form (if it does). No nav link, no CTA.  
**Reproduction:** Go to `/login` — no sign up option visible  
**Fix:** Either add a `/signup` page or add a "New here? Create an account" link on the login page that uses Supabase `signUp`.

---

### BUG-003: Phoenix WebSocket channel transition didn't broadcast (FIXED — needs Render deploy)
**Flow:** All active game flows (reveal, advance, start)  
**File:** `services/quizworld_realtime/lib/quizworld_realtime_web/channels/game_channel.ex:99`  
**Description:** `transition/3` returned snapshot only to the calling socket (host). No PubSub broadcast. All other connected clients never received state updates from host actions. This made every game mode look like classic — elimination wasn't visible, team scores didn't update, advance didn't propagate.  
**Status:** Fixed in code, **pending Render deploy**. Go to dashboard.render.com → quizworld-xs0g → Manual Deploy.

---

### BUG-004: Phoenix REST reply_with_transition didn't broadcast (FIXED — needs Render deploy)
**Flow:** All game flows via REST API  
**File:** `services/quizworld_realtime/lib/quizworld_realtime/game_server.ex:155`  
**Description:** Same as BUG-003 but for REST-based actions. Player answer submissions, join, reconnect via REST never broadcast to other clients.  
**Status:** Fixed in code, **pending Render deploy**.

---

### BUG-005: QR code from game lobby routes to presentation join (FIXED ✅)
**Flow:** Join via QR scan  
**File:** `app/join/page.tsx:89` (was)  
**Description:** 17% of Phoenix PINs are all-alpha (e.g. `MNRJVW`). The join page's `isPresentation` check fired when user clicked "Enter Game" with an all-alpha pre-filled PIN from the QR URL param. Fix: skip presentation check when `initialPin` is set from URL.  
**Status:** Fixed and deployed.

---

## P1 — Significant Degradation

### BUG-006: Survival mode — alive_count <= 1 ended game too early (FIXED ✅)
**Flow:** Survival mode game  
**File:** `services/quizworld_realtime/lib/quizworld_realtime/game.ex:411`  
**Description:** `alive_count <= 1` ended the game whenever only 1 player remained, even on Q1. Should be `< 2` (end when 0 left, i.e. 1 remaining = winner).  
**Status:** Fixed in code, **pending Render deploy**.

---

### BUG-007: Survival can start with 1 player (FIXED ✅)
**Flow:** Host — survival mode lobby  
**File:** `components/game/WaitingLobbyPanel.tsx:99`  
**Description:** Start button wasn't disabled for survival with 1 player. Team Battle blocked correctly but survival didn't. Now both require 2+.  
**Status:** Fixed and deployed.

---

### BUG-008: create/page.tsx has no authLoading guard
**Flow:** Quiz creation — auth race  
**File:** `app/create/page.tsx:35`  
**Description:** `const { user } = useAuth()` — doesn't destructure `loading`. All save/publish actions silently do nothing if `user` is null. No loading state guard. If the page loads before auth resolves, the user sees the editor but publish silently fails.  
**Reproduction:** Open `/create` in a fresh tab with slow auth restore  
**Fix:** Add `const { user, loading: authLoading } = useAuth()` and show loading state until auth resolves.

---

### BUG-009: Dashboard has no redirect for unauthenticated — shows static "Sign In Required" panel
**Flow:** Dashboard — unauthenticated access  
**File:** `app/dashboard/page.tsx:147`  
**Description:** Unauthenticated users see a static "Sign In Required" card instead of being redirected to `/login`. Same for profile page. Compare with `/host` which redirects cleanly. Inconsistent UX.  
**Fix:** Add `router.push("/login")` when `!user && !authLoading`.

---

### BUG-010: Study page still has .limit(50) on study_sessions
**Flow:** Study — session history  
**File:** `app/study/page.tsx:107`  
**Description:** The quiz catalog fetch was fixed (no limit), but `study_sessions` still has `.limit(50)`. A user with more than 50 study sessions will see truncated history and potentially incorrect XP/streak counts.  
**Fix:** Remove limit or increase to 500.

---

### BUG-011: everyoneAnswered check doesn't account for eliminated survival players
**Flow:** Active game — survival — auto-reveal  
**File:** `app/game/[pin\]/page.tsx:534`  
**Description:** `everyoneAnswered = currentAnswers.length >= players.length`. In survival, eliminated players can't answer (Phoenix rejects them). So `currentAnswers.length` will never reach `players.length` if any players are eliminated. Auto-reveal never fires for the host — host has to always manually click "Skip Question".  
**Fix:** `everyoneAnswered = currentAnswers.length >= aliveCount` (use `aliveCount` not `players.length`) in survival mode.

---

### BUG-012: Profile page — no redirect for unauthenticated
**Flow:** Profile — unauthenticated  
**File:** `app/profile/page.tsx:149`  
**Description:** Shows "Sign in to view your profile." inline text instead of redirecting to login. Inconsistent with `/host` behavior.  
**Fix:** `router.push("/login")` when `!user && !authLoading`.

---

### BUG-013: Game report (/report/[pin]) has no auth check
**Flow:** Game report  
**File:** `app/report/[pin]/page.tsx`  
**Description:** The report page doesn't verify the viewer is the host. Any user who knows the PIN can view full game results including all player names, scores, and answer breakdowns.  
**Fix:** Check `result.host_id === user?.id` and show 403 if not the host (or allow if the quiz is public).

---

### BUG-014: ShareStudyLinkButton still used on study cards — copies /study/ URL not /quiz/
**Flow:** Study — share  
**File:** `components/study/study-quiz-card.tsx:3`  
**Description:** Study cards use the old `ShareStudyLinkButton` which copies `/study/[id]` (a study session, not a shareable quiz link). The explore cards had this removed and replaced with a proper share button. Study cards were missed.  
**Fix:** Replace `ShareStudyLinkButton` on study cards with the same pattern used on explore cards (native share → clipboard copy of `/quiz/[id]`).

---

## P2 — Minor / Cosmetic

### BUG-015: Login page has no "Sign Up" link
**Flow:** Auth — onboarding  
**File:** `app/login/page.tsx`  
**Description:** No way for new users to know they can create an account. No "New user? Sign up" text. The login form may support signup via Supabase `signUp` but this isn't surfaced.

---

### BUG-016: Host header launch button always shows 🚀 regardless of game mode
**Flow:** Host — mode selection confirmation  
**File:** `app/host/page.tsx:408`  
**Description:** The small header launch button shows `"Launch 🚀"` regardless of selected mode. The bottom launch bar correctly shows 💀/👥/🚀. If the user clicks the header button they get no mode confirmation.  
**Fix:** Apply same mode-icon logic to the header button.

---

### BUG-017: Game lobby mode pill only visible below panel — easy to miss on mobile
**Flow:** Waiting lobby  
**File:** `app/game/[pin]/page.tsx:885`  
**Description:** The survival/team mode badge renders outside the lobby card, below it. On mobile it may be below the fold. Players might not notice which mode they're in.  
**Fix:** Move mode pill inside the `WaitingLobbyPanel` card (already added to panel via `game-lobby-mode-pill` — this is the lobby card pill).

---

### BUG-018: "votes" terminology fully replaced but study reveal still shows nothing
**Flow:** Study — answer reveal  
**File:** `components/study/` (various)  
**Description:** The study mode answer reveal doesn't show answer count/distribution at all. Compare to game reveal which shows counts. Minor but inconsistent.

---

### BUG-019: Present flow — /present/join input is text but shows "6-character code" which may not match actual code format
**Flow:** Presentation join  
**File:** `app/present/join/page.tsx:93`  
**Description:** Says "Enter the 6-character code from your presenter" but presentation codes in DB are hex format like `95D3B9` — technically correct but users may not know to type hex. Low impact.

---

### BUG-020: AI quiz generation — model upgraded to llama-3.3-70b but .env.local not synced to Vercel env vars
**Flow:** Create — AI from topic  
**File:** `.env.local`  
**Description:** We updated `QUIZWORLD_AI_MODEL=llama-3.3-70b-versatile` in `.env.local` and attempted to set it on Vercel, but the Vercel CLI command failed. The deployed app may still use `llama-3.1-8b-instant` from the Vercel environment.  
**Fix:** Verify in Vercel dashboard → Settings → Environment Variables that `QUIZWORLD_AI_MODEL` is set to `llama-3.3-70b-versatile`.

---

### BUG-021: No loading state on /join page when auto-reconnecting
**Flow:** Join — reconnect  
**File:** `app/join/page.tsx:39`  
**Description:** When player scans QR and has an existing session, `router.replace(`/game/${pin}`)` is called immediately with no loading indicator. Brief flash of the PIN entry screen before redirect.  
**Fix:** Show a "Reconnecting..." spinner while the redirect happens.

---

## ✅ Already Fixed This Session

| Bug | Fix |
|---|---|
| QR → presentation routing (17% of PINs) | `initialPin` guard on join page |
| Homepage routing guess misfiring | Always send to `/join`, remove `looksLikePresentation` |
| Dashboard auth race (no quizzes flash) | `authLoading` guard in `useEffect` |
| Host page auth race | Same fix |
| Study + Profile auth race | Same fix |
| Host page `.limit(100)` | Removed |
| Study page catalog `.limit(50)` | Removed |
| Explore search — only filtered 24 loaded quizzes | Live DB `ilike` query on search |
| Explore search results missing creator names | Profile lookup added to search query |
| Share button — two buttons, one faded | Removed old `ShareStudyLinkButton` from explore card |
| Share button — no feedback on copy | Shows "✅ Copied", native share sheet on mobile |
| Votes → Answers copy | Renamed across game components |
| Waiting lobby "Waiting for host" for host | Context-aware: host sees "Waiting for players…" |
| Launch splash for cold Render start | Full-screen spinner with progress messages |
| AI quiz — only 1 question returned | Fixed validator (skip bad Qs, don't throw); upgraded model |
| Answer flash always showing wrong | Fixed: feedback now fires at reveal not on click |
| Concurrent player answers lost | Staleness guard + broadcast fix (both REST + WS) |
| Survival with 1 player — game ends immediately | `alive_count < 2` (was `<= 1`) + lobby blocks start |
| Category "General Knowledge" not recognised | Added to `CATEGORY_COLORS`, `CATEGORY_EMOJIS`, DB constraint |

---

## Action Required

1. **⚠️ Render deploy needed** — Go to dashboard.render.com → quizworld-xs0g → Manual Deploy → Deploy latest commit. This deploys: broadcast fixes (BUG-003, BUG-004), numeric PINs, survival fixes (BUG-006).

2. **⚠️ Verify Vercel env var** — Check `QUIZWORLD_AI_MODEL=llama-3.3-70b-versatile` is set in Vercel dashboard (BUG-020).
