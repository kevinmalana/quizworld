# QuizWorld Current Agent Handoff

Last verified: 2026-05-18 18:00 UTC  
Production: https://www.quizworld.xyz  
Repo: https://github.com/kevinmalana/quizworld  
Workspace: `/root/.openclaw/workspace/quizworld`

## Quick Start

1. Read `docs/ENGINEERING_HANDBOOK.md` — full architecture, schema, conventions
2. Run `npm run quality` before any commit
3. Deploy: `source /root/.openclaw/secrets/deployment.env && vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz`

## Current State (2026-05-18)

### What's Live
- **Core:** quiz builder (manual/paste/AI), explore (paginated), study (flashcard/quickfire), host/join live games, present mode, dashboard
- **Social layer:** friends, classrooms, trivia groups, leaderboard, achievements, public profiles `/u/[username]`
- **Gamification:** 30-level XP system, 15 achievements (auto-unlock), day streaks, creator level badges on explore

### Services
- Phoenix health: `curl https://quizworld-xs0g.onrender.com/api/health` → `{"status":"ok","redis":true}`
- Supabase: `tqmygnkwkjtkteguemya.supabase.co`
- Service role key: `/root/.openclaw/workspace/quizworld/.env.local`

## Open Issues (priority order)

1. **In-memory rate limiter** — resets on Vercel cold start. Replace `lib/rate-limit.ts` with `@upstash/ratelimit` for production multi-instance safety
2. **`study_progress` unique constraint** — verify `(user_id, quiz_id)` unique index exists in Supabase
3. **Group admin remove members** — only classrooms have teacher-remove, not groups
4. **No push notifications** — friend requests, classroom joins have no real-time alerts

## Latest Commits
```
04b4d9f feat: achievement auto-unlock, explore creator links, auth-only rate limiter, report auth guard
0bbb3fd feat: assignment mark-complete, group pinned quizzes, /u/[username] public profiles
765d08e fix: UX gaps — leave classroom/group, remove member (teacher), stale totalXp reset
0f8c96d fix: social layer bugs — friendship dupe check, weekly XP display
4d95931 feat: social layer — friends, classrooms, trivia groups, leaderboard, achievements
```

## Quality Baseline
- TypeScript: clean
- `npm run quality`: inline_styles=130, any_count=43
- E2E: 83 tests passing against production

## Deploy Pattern
```bash
GH_TOKEN=$(tr -d '\n' < /root/.openclaw/secrets/gh_token.txt)
git push "https://x-access-token:${GH_TOKEN}@github.com/kevinmalana/quizworld.git" HEAD:main
source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz
```
