# QuizWorld — Complete Schema & Architecture Guide

_Last updated: 2026-05-07_

---

## Quick Start for Developers

### Prerequisites
- Node.js 20+
- Elixir 1.15+ / OTP 26+ (for Phoenix game engine)
- Supabase project (free tier works)
- Groq API key (free tier for AI features)

### Setup
```bash
# 1. Clone and install
cd quizworld
npm install

# 2. Environment variables
cp .env.example .env.local
# Fill in your Supabase + Groq keys

# 3. Apply database migrations
# Copy contents of supabase/migrations/APPLY_THIS_IN_SQL_EDITOR.sql
# Paste into Supabase Dashboard → SQL Editor → Run
#
# 4. Apply image questions migration (run AFTER step 3)
# Copy contents of supabase/migrations/20260506_image_questions.sql
# Paste into Supabase Dashboard → SQL Editor → Run
#
# 5. Run dev server
npm run dev          # Next.js on http://localhost:3000
cd lib/quizworld_realtime && mix phx.server  # Phoenix on http://localhost:4000
```

### Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_GAME_ENGINE=phoenix
NEXT_PUBLIC_GAME_SERVICE_URL=http://localhost:4000

QUIZWORLD_AI_API_KEY=YOUR_GROQ_API_KEY        # Groq API key
QUIZWORLD_AI_MODEL=llama-3.1-8b-instant
QUIZWORLD_AI_API_URL=https://api.groq.com/openai/v1/chat/completions
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (Vercel)                              │
│  → Quiz Builder, Dashboard, Explore, Study, Host        │
│  → Auth via Supabase Auth                               │
│  → AI generation via Groq API                           │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + Realtime subscriptions
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + Realtime)                │
│  → All persistent data                                  │
│  → RLS for security                                     │
│  → RPC functions for complex writes                     │
└──────────────────────┬──────────────────────────────────┘
                       │ RPC calls (service_role key)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phoenix Backend (Render)                               │
│  → Real-time WebSocket game engine                      │
│  → In-memory game state (GenServer per session)         │
│  → Redis for snapshot persistence (optional)            │
│  → Writes results to Supabase on game finish            │
└─────────────────────────────────────────────────────────┘
```

---

## Database Tables

### `profiles`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, FK → auth.users | |
| username | TEXT | | Display name |
| avatar | TEXT | | URL or emoji |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### `quizzes`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| creator_id | UUID | NOT NULL, FK → auth.users | |
| title | TEXT | NOT NULL | |
| category | TEXT | NOT NULL | "Trivia", "Science", etc. |
| emoji | TEXT | | Display emoji |
| color | TEXT | | Accent color |
| plays | INTEGER | NOT NULL, DEFAULT 0 | Incremented by Phoenix on game finish |
| is_public | BOOLEAN | NOT NULL, DEFAULT true | |
| archived_at | TIMESTAMPTZ | | NULL = active |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### `questions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| quiz_id | UUID | NOT NULL, FK → quizzes CASCADE | |
| text | TEXT | NOT NULL | |
| image_url | TEXT | | Optional question image URL (Supabase Storage) |
| time_limit | INTEGER | NOT NULL, DEFAULT 20 | Seconds: 10, 20, 30, 60 |
| points | INTEGER | NOT NULL, DEFAULT 1000 | 500, 1000, 2000 |
| order_index | INTEGER | NOT NULL | 0-based position |

### `answers`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| question_id | UUID | NOT NULL, FK → questions CASCADE | |
| text | TEXT | NOT NULL | |
| image_url | TEXT | | Optional answer image URL (Supabase Storage) |
| is_correct | BOOLEAN | NOT NULL, DEFAULT false | Exactly 1 per question (enforced by RPC) |

### `quiz_drafts`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| owner_id | UUID | NOT NULL, FK → auth.users | |
| quiz_id | UUID | FK → quizzes, ON DELETE SET NULL | Linked after first publish |
| title | TEXT | NOT NULL, DEFAULT '' | |
| category | TEXT | NOT NULL, DEFAULT 'Trivia' | |
| emoji | TEXT | | |
| color | TEXT | | |
| is_public | BOOLEAN | NOT NULL, DEFAULT true | |
| source_type | TEXT | NOT NULL, DEFAULT 'manual' | 'manual', 'ai-topic', 'ai-url', 'paste' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Updated on each auto-save |

### `quiz_draft_questions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| draft_id | UUID | NOT NULL, FK → quiz_drafts CASCADE | |
| text | TEXT | NOT NULL, DEFAULT '' | |
| image_url | TEXT | | Optional question image URL |
| time_limit | INTEGER | NOT NULL, DEFAULT 20 | |
| points | INTEGER | NOT NULL, DEFAULT 1000 | |
| order_index | INTEGER | NOT NULL | |

### `quiz_draft_answers`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| question_id | UUID | NOT NULL, FK → quiz_draft_questions CASCADE | |
| text | TEXT | NOT NULL, DEFAULT '' | |
| image_url | TEXT | | Optional answer image URL |
| is_correct | BOOLEAN | NOT NULL, DEFAULT false | |
| order_index | INTEGER | NOT NULL | |

### `quiz_versions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| quiz_id | UUID | NOT NULL, FK → quizzes CASCADE | |
| creator_id | UUID | NOT NULL, FK → auth.users | |
| version_number | INTEGER | NOT NULL | Per-quiz increment |
| title | TEXT | NOT NULL | |
| category | TEXT | NOT NULL | |
| emoji | TEXT | | |
| color | TEXT | | |
| is_public | BOOLEAN | NOT NULL, DEFAULT true | |
| snapshot | JSONB | NOT NULL | Full question/answer tree |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| | | UNIQUE (quiz_id, version_number) | |

### `game_sessions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| pin | TEXT | NOT NULL, UNIQUE | 6-char game PIN |
| quiz_id | UUID | NOT NULL, FK → quizzes | |
| host_id | UUID | FK → auth.users | |
| status | TEXT | NOT NULL, DEFAULT 'waiting' | CHECK: waiting, active, reveal, finished |
| current_question_index | INTEGER | NOT NULL, DEFAULT -1 | |
| game_mode | TEXT | NOT NULL, DEFAULT 'classic' | |
| question_started_at | TIMESTAMPTZ | | For timer calculation |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### `game_results`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| pin | TEXT | NOT NULL, UNIQUE | |
| quiz_id | UUID | NOT NULL, FK → quizzes | |
| host_id | UUID | FK → auth.users | |
| player_count | INTEGER | NOT NULL, DEFAULT 0 | |
| results | JSONB | NOT NULL, DEFAULT '{}' | Player scores and rankings |
| finished_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

---

## RPC Functions

### `publish_quiz(p_title, p_category, p_emoji, p_color, p_is_public, p_questions) → UUID`
Creates a new quiz from the builder.
- Validates auth, title, at least 1 complete question
- Enforces exactly 1 correct answer per question
- Creates: quiz → questions → answers → version snapshot
- Returns: new quiz UUID

**Questions JSON format:**
```json
[
  {
    "text": "What is 2+2?",
    "time_limit": 20,
    "points": 1000,
    "answers": [
      {"text": "4", "is_correct": true},
      {"text": "3", "is_correct": false},
      {"text": "5", "is_correct": false},
      {"text": "22", "is_correct": false}
    ]
  }
]
```

### `republish_quiz(p_quiz_id, p_title, p_category, p_emoji, p_color, p_is_public, p_questions) → JSONB`
Updates an existing quiz with a new version.
- Creates version snapshot of current state
- Deletes old questions/answers
- Inserts new questions/answers
- Returns: `{"quiz_id": UUID, "version_number": INT}`

### `record_game_result(p_pin, p_quiz_id, p_host_id, p_player_count, p_results, p_finished_at) → VOID`
Called by Phoenix game engine on game finish.
- Inserts/updates game_results row (upsert on pin)
- Increments quizzes.plays on first insert
- Granted to `service_role` only

**Results JSON format:**
```json
{
  "players": [
    {"id": "abc", "nickname": "Player1", "avatar": "🎮", "score": 1500}
  ],
  "question_count": 5,
  "finished_status": "finished"
}
```

---

## Data Flow

### Quiz Creation Flow
```
1. User types in builder
   → Auto-saves to quiz_drafts + quiz_draft_questions + quiz_draft_answers
   → 2.5 second debounce after each change

2. User clicks "Publish"
   → Calls publish_quiz RPC
   → Creates: quizzes + questions + answers + quiz_versions
   → Draft updated with quiz_id link
   → Redirects to /dashboard

3. User clicks "Update" (republish)
   → Calls republish_quiz RPC
   → Creates new quiz_versions snapshot
   → Replaces questions/answers
   → Redirects to /dashboard
```

### Game Flow
```
1. Host clicks "Host" on a quiz
   → Frontend calls Phoenix: POST /api/sessions
   → Phoenix verifies Supabase auth token
   → Creates in-memory Game struct
   → Inserts game_sessions row in Supabase
   → Returns: { host_token, session: { pin, ... } }

2. Players join via PIN
   → WebSocket: "player:join" event
   → Phoenix adds player to in-memory Game
   → No Supabase write (in-memory only)

3. Game plays
   → Host: "host:start" → game status = "active"
   → Players: "player:answer" → stored in memory
   → Timer auto-triggers reveal after time_limit
   → Host: "host:reveal" → shows correct answer
   → Host: "host:advance" → next question or finish

4. Game finishes
   → Phoenix calls Supabase: record_game_result RPC
   → game_results row created
   → quizzes.plays incremented
   → Game auto-cleaned from memory after 15min
```

### AI Generation Flow
```
1. User enters topic/URL/paste text
2. Frontend calls /api/ai-source-draft
3. Next.js API route calls Groq (llama-3.1-8b-instant)
4. LLM returns structured JSON with questions + answers + citations
5. JSON validated by validateAIQuizDraft()
6. Questions loaded into builder
```

---

## RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | everyone | own | own | — |
| quizzes | public + own | via RPC | via RPC | — |
| questions | public + own | via RPC | via RPC | — |
| answers | public + own | via RPC | via RPC | — |
| quiz_versions | own | own | — | — |
| quiz_drafts | own | own | own | own |
| quiz_draft_questions | own (via draft) | own (via draft) | own (via draft) | own (via draft) |
| quiz_draft_answers | own (via draft) | own (via draft) | own (via draft) | own (via draft) |
| game_sessions | host | Phoenix (service_role) | — | — |
| game_results | host | Phoenix (service_role) | — | — |

---

## File Structure

```
quizworld/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── ai-source-draft/      # AI quiz generation endpoint
│   │   └── import-url/           # URL content extraction
│   ├── create/                   # Quiz builder page
│   ├── dashboard/                # Creator dashboard
│   ├── explore/                  # Public quiz browser
│   ├── game/[pin]/               # Game host view (Next.js)
│   ├── host/                     # Host setup page
│   ├── join/                     # Player join page
│   ├── login/                    # Auth page
│   ├── profile/                  # User profile
│   ├── study/                    # Study mode
│   ├── layout.tsx                # Root layout (ErrorBoundary + Auth)
│   └── globals.css               # Design system + Tailwind
├── components/
│   ├── builder/                  # Builder components
│   │   ├── BuilderToolbar.tsx    # Top toolbar (title, save, publish)
│   │   ├── QuestionCard.tsx      # Question editor
│   │   ├── QuestionSidebar.tsx   # Question list sidebar
│   │   ├── SourcePicker.tsx      # Source type selector
│   │   └── AnswerEditor.tsx      # Answer option editor
│   ├── error-boundary.tsx        # React error boundary
│   ├── navigation.tsx            # Site navigation
│   ├── page-hero.tsx             # Hero section component
│   ├── section-card.tsx          # Card section component
│   └── supabase-provider.tsx     # Auth context
├── lib/
│   ├── game-engine/
│   │   ├── client.ts             # Phoenix API client
│   │   ├── config.ts             # Engine config (phoenix vs supabase)
│   │   └── phoenix-socket.ts     # WebSocket connection
│   ├── supabase/
│   │   └── client.ts             # Supabase client
│   ├── quiz-ai.ts                # AI prompt + validation
│   ├── quiz-drafts.ts            # Draft data types
│   ├── quiz-import.ts            # Paste/URL import parsing
│   ├── rate-limit.ts             # API rate limiting
│   ├── logger.ts                 # Production-safe logger
│   └── store.ts                  # Local state types
├── lib/quizworld_realtime/       # Phoenix game engine (Elixir)
│   ├── game.ex                   # Game state struct + logic
│   ├── game_server.ex            # GenServer per game session
│   ├── games.ex                  # Public API
│   ├── result_sync.ex            # Supabase result writer
│   ├── state_store.ex            # Redis snapshot persistence
│   └── quizworld_realtime_web/
│       ├── live/game_live/show.ex # Game UI (LiveView)
│       ├── channels/             # WebSocket channels
│       └── controllers/          # REST API controllers
├── supabase/
│   └── migrations/
│       ├── APPLY_THIS_IN_SQL_EDITOR.sql  # Full migration (run this!)
│       └── 20260327-20260331_*.sql        # Individual migrations
├── docs/
│   └── SUPABASE_SCHEMA.md        # This file
├── postcss.config.mjs            # Tailwind v4 PostCSS config
├── next.config.ts                # Next.js config
└── vercel.json                   # Vercel deployment config
```

---

## Deployment

### Frontend (Vercel)
```bash
source /root/.openclaw/secrets/deployment.env
vercel --prod --yes --token "$VERCEL_TOKEN"
```

### Game Engine (Render)
- Auto-deploys from GitHub push to `quizworld` repo
- Health check: `GET /api/health`
- Requires: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL` (optional)

### Database (Supabase)
- Run `supabase/APPLY_SUPABASE_COMPLETE_2026-05-07.sql` in SQL Editor
- Verify with: `SELECT proname FROM pg_proc WHERE proname IN ('publish_quiz', 'republish_quiz', 'record_game_result')`

---

## Known Issues (as of 2026-05-06)


### Fixed (2026-05-07)
- ✅ Join / Enter Game PIN characters no longer clip inside the six PIN boxes.
- ✅ Production deploy confirmed after PIN UI hotfix.

### Fixed (2026-05-06)
- ✅ CORS: `ALLOWED_ORIGINS` now defaults to `https://www.quizworld.xyz` (was `http://localhost:3000`)
- ✅ `SECRET_KEY_BASE` replaced with proper generated secret
- ✅ `PHX_HOST` defaults to `quizworld-xs0g.onrender.com` (was `localhost`)
- ✅ Rate limiting added to AI endpoints (10 req/min for AI, 5 req/min for URL import)
- ✅ Error boundary wraps all pages
- ✅ robots.txt + dynamic sitemap.xml added
- ✅ Publish/republish RPC missing `p_color` param fixed
- ✅ Draft save missing `color` field fixed
- ✅ Auto-save now triggers on title/category/emoji/public changes
- ✅ Tailwind v4 PostCSS config created (utilities weren't generating)
- ✅ Sidebar hidden on mobile with responsive breakpoint
- ✅ Game engine UI refactor (shared design tokens, mobile fixes)

### Still Needs Fixing
1. **Redis not connected** — Phoenix health shows `redis:false`. Add `REDIS_URL` on Render (Upstash free tier)
2. **SQL migrations need confirmation** — Run/verify `supabase/APPLY_SUPABASE_COMPLETE_2026-05-07.sql` in Supabase SQL Editor to create all tables, policies, storage bucket, and RPC functions
3. **No password reset** — Users can't recover accounts
4. **No staging environment** — Deploys go straight to production
5. **Supabase Auth redirect URLs** — Set in Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://www.quizworld.xyz`
   - Redirect URLs: `https://www.quizworld.xyz/login`
6. **Supabase Realtime** — Enable on `game_sessions` table for live updates if needed

---

## Supabase Storage

### Bucket: `quiz-images`
- **Public:** true (images are publicly accessible)
- **Max file size:** 5MB
- **Allowed types:** JPEG, PNG, GIF, WebP
- **Path structure:** `{user_id}/{timestamp}-{random}.{ext}`

### RLS Policies
- **SELECT:** Anyone (public bucket)
- **INSERT:** Authenticated users, path must start with their user ID
- **DELETE:** Own images only (path starts with user ID)

### Usage
```typescript
// Upload
const { data } = await supabase.storage
  .from('quiz-images')
  .upload(`${user.id}/${Date.now()}.jpg`, file);

// Get public URL
const { data: url } = supabase.storage
  .from('quiz-images')
  .getPublicUrl(path);
```

### Image Fields
- `questions.image_url` — optional question image (e.g. "What is this building?")
- `answers.image_url` — optional answer images (e.g. 4 photo choices)
- `quiz_draft_questions.image_url` — draft question image
- `quiz_draft_answers.image_url` — draft answer images
