# QuizWorld Supabase Audit — 2026-05-10

## Executive Summary

**3 critical security issues**, stale data across 6 tables, 5 unused tables, and 5 orphaned RPCs from the legacy game engine.

---

## 1. 🚨 SECURITY (CRITICAL)

### Anon key has DELETE/INSERT access

| Table | Anon READ | Anon INSERT | Anon DELETE | Risk |
|---|---|---|---|---|
| `quizzes` | ✅ 200 | ❌ 401 | ⚠️ **204** | **Anyone can delete any quiz** |
| `profiles` | ✅ 200 | ❌ 401 | ⚠️ **204** | **Anyone can delete any user profile** |
| `game_results` | ✅ 200 | ⚠️ **201** | ❌ 401 | **Anyone can inject fake game results** |
| `quiz_drafts` | ✅ 200 | ❌ 401 | ❌ 401 | Leaks private draft data |
| `study_progress` | ✅ 200 | ❌ 401 | ❌ 401 | Leaks user study data |
| `game_sessions` | ✅ 200 | ❌ 400 | ❌ 401 | Leaks session data |
| `player_sessions` | ❌ 401 | ❌ 401 | ❌ 401 | ✅ Properly secured |

**Immediate actions needed:**
1. Enable RLS on `quizzes` — add policy: only creator can delete
2. Enable RLS on `profiles` — add policy: only owner can delete
3. Enable RLS on `game_results` — add policy: only authenticated hosts can insert
4. Add SELECT policies on `quiz_drafts`, `study_progress` — restrict to owner only

### Tables readable by anon that should be private

- `quiz_drafts` — user's private draft data exposed
- `study_progress` — user's study history exposed  
- `profiles` — email/username exposed (acceptable if intentional for public profiles)
- `game_sessions` — host_id, status exposed

---

## 2. 🧹 STALE DATA

### Game Sessions (28 total)
- 28 legacy Supabase game sessions from March 2026
- All pre-date the Phoenix migration — safe to archive or delete
- Status breakdown: need to check (was truncated)

### Players (5 total)
- 5 legacy players from March 2026 (Jake, Paul, harry)
- All have `score: 0`, `is_active: true`
- Linked to old Supabase sessions, not Phoenix

### Player Sessions (4 total)
- 4 legacy auth tokens from March 2026
- No longer used (Phoenix handles auth)

### Game Results (15 total)
- Mix of real results and test data
- `SQL_TEST_999` pin = test entry
- Most from May 2026 — keep these

### Quizzes with 0 plays (7)
| Quiz | Public | Action |
|---|---|---|
| Test Quiz | No | Delete |
| OpenClaw Integration Test | No | Delete |
| Indian Cricket Quiz | Yes | Duplicate — check |
| Sri Lanka Quiz | Yes | Duplicate — check |
| Indian Cricket Quiz | Yes | Duplicate — check |
| Publish Test Quiz | Yes | Delete |
| Exploring the Solar System | Yes | Keep (new) |

### Quiz Drafts (13 total)
- 3 "Untitled Draft" from March 2026 — stale, safe to delete
- 4 unnamed drafts (empty title) from May — likely test drafts
- 6 named drafts — keep

### Q&A Data
- 1 qna_question, 0 upvotes — test data from present feature testing

---

## 3. 🗑️ UNUSED TABLES & RPCS

### Tables not used by the app

| Table | Rows | Status |
|---|---|---|
| `player_sessions` | 4 | Legacy Supabase auth — safe to drop |
| `qna_question_upvotes` | 0 | Legacy — now handled by Phoenix |
| `qna_questions` | 1 | Legacy — now handled by Phoenix |
| `answers` | 284 | Legacy schema — app uses `questions.answers` JSONB |
| `questions` | 71 | Legacy schema — app uses `quizzes.questions` relation |

**Note:** `answers` and `questions` tables may still be referenced by old quiz data. Check before dropping.

### RPCs not used by the app

| RPC | Status |
|---|---|
| `start_game_session` | Legacy — replaced by Phoenix |
| `advance_game_session` | Legacy — replaced by Phoenix |
| `reveal_current_question` | Legacy — replaced by Phoenix |
| `submit_player_answer` | Legacy — replaced by Phoenix |
| `join_game_session` | Legacy — replaced by Phoenix |
| `record_game_result` | May still be used for saving results |

**Active RPCs:**
- `save_presentation` ✅
- `create_presentation` ✅  
- `publish_quiz` ✅
- `republish_quiz` ✅

---

## 4. 📊 PERFORMANCE (needs direct DB access)

Cannot verify indexes without `psql` access. Recommended indexes based on query patterns:

- `game_sessions.host_id` — filtered by host in dashboard
- `quizzes.creator_id` — filtered by creator everywhere
- `game_results.host_id` — filtered by host in dashboard/reports
- `study_progress.user_id` — filtered by user in study page
- `quiz_drafts.owner_id` — filtered by owner in dashboard

---

## Recommended Actions

### Priority 1 — Security (do now)
1. Enable RLS on all tables
2. Add policies: owner-only DELETE on `quizzes`, `profiles`
3. Add policy: authenticated-only INSERT on `game_results`
4. Add policy: owner-only SELECT on `quiz_drafts`, `study_progress`

### Priority 2 — Stale data cleanup
1. Delete 3 "Untitled Draft" records from `quiz_drafts`
2. Delete test quizzes: "Test Quiz", "OpenClaw Integration Test", "Publish Test Quiz"
3. Delete `SQL_TEST_999` game result
4. Archive/delete 28 legacy game sessions + 5 players + 4 player_sessions

### Priority 3 — Schema cleanup
1. Drop unused tables: `player_sessions`, `qna_question_upvotes`, `qna_questions`
2. Evaluate dropping: `answers`, `questions` (check for references first)
3. Drop unused RPCs: `start_game_session`, `advance_game_session`, `reveal_current_question`, `submit_player_answer`, `join_game_session`

### Priority 4 — Performance
1. Add indexes on foreign keys listed above
2. Run `ANALYZE` on frequently queried tables
