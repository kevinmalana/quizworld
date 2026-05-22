# QuizWorld Current Agent Handoff

Last verified: 2026-05-22 17:00 UTC  
Production: https://www.quizworld.xyz  
Repo: https://github.com/kevinmalana/quizworld  
Workspace: `/root/.openclaw/workspace/quizworld`

## Quick Start

1. Read `docs/ENGINEERING_HANDBOOK.md` — full architecture, schema, conventions
2. Run `npm run quality` before any commit
3. Deploy: `source /root/.openclaw/secrets/deployment.env && vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz`

## Current State (2026-05-22)

### What's Live
- **Core:** quiz builder (manual/paste/AI), explore (paginated), study (flashcard/quickfire), host/join live games, present mode, dashboard
- **Social layer:** friends, classrooms, trivia groups, leaderboard, achievements, public profiles `/u/[username]`
- **Gamification:** 30-level XP system, 15 achievements (auto-unlock), day streaks, creator level badges on explore
- **UI:** LinkedIn-style layout (square corners, flat shadows, system fonts) with original QuizWorld brand colors
- **Explore page:** Super-categories (6 groups), trending rows (🔥/✨/🏆), collections (UI-only), Surprise Me button
- **Quiz detail page:** `/quiz/[id]` — title/creator/stats/question preview, Play + Study buttons
- **Post-game CTA:** Play Again / Find Another Quiz / Create Your Own / Share Score after every game
- **Share button:** on explore cards and quiz detail page (clipboard copy)
- **Onboarding:** 5-step checklist + dismissible welcome banner for new users on dashboard
- **Category dropdown:** builder uses `<select>` from CATEGORY_EMOJIS — no free-text category entry

### Services
- Phoenix health: `curl https://quizworld-xs0g.onrender.com/api/health` → `{"status":"ok","redis":true}`
- Supabase: `tqmygnkwkjtkteguemya.supabase.co`
- Service role key: `/root/.openclaw/workspace/quizworld/.env.local`

## Open Issues (priority order)

1. **🔴 SECURITY: Private quiz RLS** — anon users can read `is_public=false` quizzes. Fix by running in Supabase SQL editor:
   ```sql
   DROP POLICY IF EXISTS "Public quizzes are viewable by everyone" ON quizzes;
   CREATE POLICY "Public quizzes are viewable by everyone" ON quizzes
     FOR SELECT USING (is_public = true AND archived_at IS NULL);
   CREATE POLICY "Owners can view their own private quizzes" ON quizzes
     FOR SELECT USING (auth.uid() = creator_id);
   ```
2. **🔴 SECURITY: game_results readable by anon** — game results (scores/player counts) visible without auth. Add RLS: `FOR SELECT USING (auth.uid() IS NOT NULL)`
3. **In-memory rate limiter** — resets on Vercel cold start. Replace `lib/rate-limit.ts` with `@upstash/ratelimit` for production multi-instance safety
4. **Collections (explore)** — hardcoded UI only. Add `collections` table when content grows past 50+ quizzes
5. **Study checklist step** — onboarding checklist always shows Study as incomplete (no study_progress count in dashboard query)
6. **`study_progress` unique constraint** — verify `(user_id, quiz_id)` unique index exists in Supabase
7. **Group admin remove members** — only classrooms have teacher-remove, not groups
8. **No push notifications** — friend requests, classroom joins have no real-time alerts

## Latest Commits
```
cf86cf1 feat: category dropdown, post-game CTA, quiz detail page, share button, onboarding
ffdb58d feat(explore): super-categories, trending rows, collections, surprise-me
faace4b fix: hide mobile props toggle on desktop (settings wheel not clickable)
1c93fff layout-linkedin: restore QuizWorld brand colors, keep square layout
a6b62ea layout-linkedin: square corners, LinkedIn blue, flat shadows, system fonts
```

## New Files (2026-05-22)
- `app/quiz/[id]/page.tsx` — quiz detail server component
- `app/quiz/[id]/QuizDetailShareButton.tsx` — client share button
- `components/shared/OnboardingChecklist.tsx` — dashboard onboarding checklist
- `components/game/GameFinishedPanel.tsx` — updated with post-game CTA
- `components/explore/explore-quiz-card.tsx` — updated with share + detail link
- `components/builder/BuilderToolbar.tsx` — category `<select>` dropdown

## Code Architecture (2026-05-19)

### Components Structure
- `components/game/` — 14 individual component files (refactored from 1 monolith)
  - Import via `from "@/components/game"` (index.ts re-exports all)
  - Largest: `GameFinishedPanel.tsx` (244 lines), `WaitingLobbyPanel.tsx` (118 lines)
  - Smallest: `GameNotice.tsx` (11 lines)
- `app/game/[pin]/page.tsx` — still monolithic (1022 lines)
  - **Warning:** Contains 25+ useState hooks, multiple useEffects
  - State logic is tightly coupled to render
  - Further extraction requires extensive testing
  - Recommend: leave as-is unless adding game features

## Quality Baseline
- TypeScript: clean
- Phoenix: 44/44 tests passing
- `npm run quality`: inline_styles=130, any_count=43
- E2E: 108 tests passing (production)

## Deploy Pattern
```bash
GH_TOKEN=$(tr -d '\n' < /root/.openclaw/secrets/gh_token.txt)
git push "https://x-access-token:${GH_TOKEN}@github.com/kevinmalana/quizworld.git" HEAD:main
source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz
```
