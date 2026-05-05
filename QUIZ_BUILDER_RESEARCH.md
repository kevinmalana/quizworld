# Quiz Builder Competitive Research & Improvement Plan
**Date:** 2026-05-05
**Status:** Research complete, ready for implementation decisions

---

## Current State (QuizWorld)

**What we have:**
- 1 question type: multiple choice (4 answers, 1 correct)
- True/False quick-add button
- Time limit: 10s / 20s / 30s / 60s
- Points: 500 / 1000 / 2000
- 5 source types: Manual, Paste, Topic Starter (AI), From URL, Document
- Autosave to Supabase (2.5s debounce)
- Question validation (empty text, blank answers)
- Undo/redo
- Question search/filter in sidebar

**What we don't have:** Almost everything the top platforms offer.

---

## Competitor Analysis

### Tier 1: The Big Players

#### Kahoot (kahoot.com)
- **Question types:** Quiz (MC), True/False, Slider (numeric range), Poll, Word Cloud, Puzzle (put in order), Open-ended (typed text), Brainstorm
- **Builder UX:** Slide-based editor, drag-to-reorder, image/video embed per question, question bank from community (500M+ games)
- **Game modes:** Live (host-paced), Student-paced (async), Ghost mode (play against past scores)
- **Engagement:** Music, animations, color psychology, timer pressure, podium reveal
- **Analytics:** Question-level accuracy, player reports, class performance trends
- **Pricing:** Free (10 players), Pro $17/mo
- **Weakness:** No AI generation, only MC for free tier, requires student accounts

#### Quizizz (now Wayground)
- **Question types:** MC, True/False, Fill-in-the-blank, Checkbox (multi-select), Poll, Draw (sketch answer), Drag-and-drop, Open-ended, Audio response
- **Builder UX:** Question-by-question editor, image upload, meme system (correct/incorrect answer feedback images), question library
- **Game modes:** Live (host-paced), Async (self-paced), Team mode
- **Engagement:** Power-ups (game mechanics), memes on answer reveal, music, leaderboards
- **Analytics:** Student progress tracking, question-level analytics, mastery data
- **Pricing:** Free (limited), $19/mo for teachers
- **Weakness:** No AI from documents, cluttered interface

#### QuizForge (new entrant, 2026)
- **Key differentiator:** AI generates quizzes from PDF/PowerPoint/Word in 30 seconds
- **Question types:** MC, True/False
- **Builder UX:** Upload → AI generates → review → edit → publish
- **Pricing:** Free (unlimited quizzes), Pro $9/mo
- **Weakness:** No live games yet, limited question types

### Tier 2: Niche Leaders

#### TriviaMaker
- **8 game show formats:** Grid, Wheel, List (Feud), Buzzer, Trivia, Slide, Word, Map
- **No-login participation:** Players join via code in browser
- **Crowd mode:** Up to 2,000 simultaneous players
- **AI generation:** Complete games in 60 seconds
- **Pricing:** Free unlimited, Premium $6.99/mo

#### Typeform
- **Conversational UX:** One question at a time, smooth transitions
- **Branching logic:** Conditional paths based on answers
- **Design focus:** Beautiful, minimal, brand-customizable
- **Quiz types:** Personality, scored, trivia, lead-gen
- **Weakness:** Not built for multiplayer/live games

#### Sporcle
- **Quiz types:** Classic (type answer), Clickable, Slideshow, Picture Box, Map, Text Memorizer, Arcade
- **Community-driven:** Massive UGC library
- **Unique:** Map quizzes, timed typing challenges
- **Weakness:** No multiplayer, no AI

#### BuzzFeed Community
- **Quiz types:** Personality, Trivia, Checklist, Poll, Tap-on-image
- **Key insight:** Personality quizzes ("Which character are you?") drive massive social sharing
- **Result types:** Multiple outcomes with images, descriptions
- **Weakness:** No real-time multiplayer

---

## Gap Analysis: QuizWorld vs Best-in-Class

| Feature | QuizWorld | Kahoot | Quizizz | TriviaMaker | Priority |
|---------|-----------|--------|---------|-------------|----------|
| Multiple choice | ✅ | ✅ | ✅ | ✅ | — |
| True/False | ✅ | ✅ | ✅ | ✅ | — |
| Fill-in-the-blank | ❌ | ❌ | ✅ | ❌ | HIGH |
| Multi-select (checkbox) | ❌ | ❌ | ✅ | ❌ | HIGH |
| Poll (no right answer) | ❌ | ✅ | ✅ | ✅ | MEDIUM |
| Numeric slider | ❌ | ✅ | ❌ | ❌ | LOW |
| Puzzle/ordering | ❌ | ✅ | ❌ | ❌ | MEDIUM |
| Open-ended (typed) | ❌ | ✅ | ✅ | ❌ | MEDIUM |
| Image answers | ❌ | ✅ | ✅ | ✅ | HIGH |
| Image per question | ❌ | ✅ | ✅ | ✅ | HIGH |
| Video embed | ❌ | ✅ | ❌ | ❌ | LOW |
| Drag-to-reorder questions | ❌ | ✅ | ✅ | ✅ | HIGH |
| AI from topic | ✅ | ❌ | ⚠️ | ✅ | — |
| AI from document | ✅ | ❌ | ❌ | ✅ | — |
| AI from URL | ✅ | ❌ | ❌ | ❌ | — |
| Personality quiz mode | ❌ | ❌ | ❌ | ❌ | HIGH |
| Branching logic | ❌ | ❌ | ❌ | ❌ | MEDIUM |
| Answer feedback/explanation | ❌ | ❌ | ✅ | ❌ | HIGH |
| Custom themes/colors | ❌ | ✅ | ✅ | ✅ | MEDIUM |
| Question bank/templates | ❌ | ✅ | ✅ | ✅ | MEDIUM |
| Meme/fun feedback | ❌ | ❌ | ✅ | ❌ | LOW |
| Duplicate question | ✅ | ✅ | ✅ | ✅ | — |
| Bulk import (CSV) | ❌ | ❌ | ❌ | ✅ | MEDIUM |

---

## Recommended Improvements (Phased)

### Phase 1: Foundation (1-2 weeks) — Close the basics gap

**1. Image support (question + answer level)**
- Add image URL or upload field to Question and Answer types
- Show image thumbnail in builder sidebar
- Display image during gameplay
- Storage: Use Supabase Storage or keep as URLs
- Schema change: `questions.image_url`, `answers.image_url`

**2. Drag-to-reorder questions**
- Replace up/down buttons with drag-and-drop (use `@dnd-kit/core`)
- Drag handle on each question card in sidebar
- Visual feedback during drag
- Auto-update `order_index` on drop

**3. Answer feedback/explanation**
- Add optional `explanation` field to questions
- Show after answer reveal during game
- "Why this is correct: ..."
- Schema change: `questions.explanation TEXT`

**4. Fill-in-the-blank question type**
- New type where player types the answer
- Case-insensitive matching, optional accepted aliases
- Schema: new `question_type` column, `answers.accepted_answers TEXT[]`

**5. Multi-select (checkbox) question type**
- Multiple correct answers
- Player checks all that apply
- Partial credit scoring
- Schema: `question_type = 'multi_select'`

### Phase 2: Differentiation (2-3 weeks) — Stand out from competitors

**6. Personality quiz mode**
- BuzzFeed-style "Which X are you?" quizzes
- Each answer maps to a result/outcome
- Multiple possible results with images and descriptions
- Social sharing with result cards
- Schema: `quizzes.quiz_type TEXT ('trivia'|'personality')`, new `quiz_results` table

**7. Poll mode (no right answer)**
- Questions with no correct answer
- Show live results as players vote
- Good for opinion gathering, icebreakers
- Schema: `question_type = 'poll'`

**8. Question templates / starter packs**
- Pre-built question sets by category
- "Geography Starter Pack" with 10 template questions
- One-click to clone into builder
- Stored as public template quizzes in Supabase

**9. Custom themes**
- Quiz-level color scheme (background, accent, text)
- Theme presets (Neon, Pastel, Dark, Ocean, Sunset)
- Schema: `quizzes.theme JSONB`

### Phase 3: Power features (3-4 weeks) — Compete with Kahoot

**10. Puzzle/ordering question type**
- Drag items into correct order
- E.g., "Put these presidents in order"
- Schema: `question_type = 'ordering'`

**11. Numeric slider question type**
- Estimate a number within a range
- Closest answer wins
- Schema: `question_type = 'slider'`, `questions.slider_min`, `questions.slider_max`

**12. Open-ended (typed response)**
- Players type free-text answers
- Host reviews/grades manually OR keyword matching
- Schema: `question_type = 'open_ended'`

**13. Branching logic**
- Conditional paths based on answer
- "If answered A → go to question 5, else → question 3"
- Good for adaptive difficulty or narrative quizzes
- Schema: `answers.next_question_id`

**14. Bulk import (CSV/Excel)**
- Upload CSV with columns: Question, A, B, C, D, Correct, Time, Points
- Parse and preview before import
- API route: `/api/import-csv`

---

## Schema Changes Summary

```sql
-- Phase 1
ALTER TABLE questions ADD COLUMN question_type TEXT DEFAULT 'multiple_choice';
ALTER TABLE questions ADD COLUMN image_url TEXT;
ALTER TABLE questions ADD COLUMN explanation TEXT;
ALTER TABLE answers ADD COLUMN image_url TEXT;
ALTER TABLE answers ADD COLUMN accepted_answers TEXT[]; -- for fill-in-the-blank

-- Phase 2
ALTER TABLE quizzes ADD COLUMN quiz_type TEXT DEFAULT 'trivia'; -- 'trivia'|'personality'
ALTER TABLE quizzes ADD COLUMN theme JSONB;
CREATE TABLE quiz_results (...); -- personality quiz outcomes

-- Phase 3
ALTER TABLE questions ADD COLUMN slider_min NUMERIC;
ALTER TABLE questions ADD COLUMN slider_max NUMERIC;
ALTER TABLE answers ADD COLUMN next_question_id UUID; -- branching
```

---

## Competitive Positioning

**Kahoot's weakness:** No AI, no personality quizzes, expensive, requires accounts
**Quizizz's weakness:** No AI from documents, cluttered UI
**TriviaMaker's weakness:** No self-paced mode, limited analytics
**Typeform's weakness:** No multiplayer, no live games

**QuizWorld's unique position:**
- ✅ AI generation (topic, URL, document) — already ahead
- ✅ Live multiplayer with Phoenix — already working
- ✅ Free forever — strong value prop
- ❌ Missing: question type variety, images, personality quizzes, drag-drop

**The play:** Be the only platform that combines AI generation + live multiplayer + personality quizzes + beautiful UX. Kahoot doesn't have AI. Quizizz doesn't have personality quizzes. Nobody has all three.

---

## Implementation Order (Recommended)

1. **Image support** — unblocks everything, high visual impact
2. **Drag-to-reorder** — basic UX expectation
3. **Answer feedback** — education-critical
4. **Fill-in-the-blank** — most requested question type
5. **Multi-select** — second most requested
6. **Personality quizzes** — viral/shareable, differentiator
7. **Poll mode** — easy to build, social value
8. **Custom themes** — brand value
9. **Question templates** — content moat
10. **Puzzle/ordering** — engagement boost
11. **Open-ended** — classroom value
12. **Branching logic** — power users
13. **CSV import** — power users
14. **Numeric slider** — niche but easy

---

## Quick Wins (Do Today)

1. Add `explanation` field to questions (schema + UI)
2. Add `image_url` field to questions (schema + UI)
3. Add `question_type` column to support future types
4. Replace up/down arrows with drag-to-reorder

These 4 changes alone would put us ahead of where we are now and prepare the schema for everything else.
