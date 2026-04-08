# Historical Note

This file is a V5 to V6 visual history document, not the current operational reference.
Use [START_HERE.md](./START_HERE.md) for the current handoff path.

# V6 Changelog — QuizWorld Premium Redesign

**Release:** V6.0.0
**Date:** March 2026
**Type:** Full UI/UX redesign (no functional changes to data layer)

---

## Summary

V6 is a complete visual overhaul of QuizWorld. Every page, component, and CSS class has been redesigned to move from a cartoonish, heavy-shadow aesthetic to a modern, premium design language. Zero breaking changes to the data model — existing localStorage data from V5 continues to work.

---

## What Changed (and What Didn't)

### Changed
- `app/globals.css` — Complete rewrite (new design system)
- `app/layout.tsx` — Updated font imports, nav height variable
- `app/page.tsx` — Redesigned home page
- `app/create/page.tsx` — Refined quiz builder
- `app/dashboard/page.tsx` — Clean dashboard redesign
- `app/explore/page.tsx` — Better search & card grid
- `app/join/page.tsx` — Polished PIN entry flow
- `app/host/page.tsx` — Modern config panel & lobby
- `app/game/[pin]/page.tsx` — Premium game experience
- `app/study/page.tsx` — Refined study hall
- `app/study/[id]/page.tsx` — Better flashcards & quick-fire
- `app/profile/page.tsx` — Modern profile & achievements
- `components/navigation.tsx` — Glassmorphic nav

### NOT Changed
- `lib/store.ts` — Data layer is 100% unchanged
- `tsconfig.json` — No config changes
- `next.config.ts` — No config changes
- `package.json` — No new dependencies added

---

## Design Changes: V5 → V6

### Colors

| Element            | V5                          | V6                          |
|--------------------|-----------------------------|-----------------------------|
| Page background    | `#f6f8fc` / `#f8fafc`      | `#f8f9fc` (unified)         |
| Accent color       | `#6d5df6` (purple)          | `#7c3aed` (electric violet) |
| Primary/Red        | `#de5e76` (muted rose)      | `#e11d48` (vivid rose)      |
| Secondary/Blue     | `#2d7ff0`                   | `#2563eb`                   |
| Success/Green      | `#1f9d6c`                   | `#059669`                   |
| Warning/Yellow     | `#f2c14b`                   | `#d97706` (amber)           |
| Text primary       | `#15213b`                   | `#0f172a`                   |
| Text muted         | `#66748f`                   | `#64748b`                   |
| Borders            | `#22314f` (dark) + `#d7deea`| `#e2e8f0` (subtle) + `#cbd5e1` |

### Cards & Surfaces

| Property       | V5                                            | V6                                   |
|----------------|-----------------------------------------------|--------------------------------------|
| Border         | `3px solid #1e293b`                           | `1px solid var(--line)`              |
| Border radius  | `24px`                                        | `20px` (`--radius-xl`)               |
| Box shadow     | `0 8px 0 #1e293b` (hard 3D)                  | `0 4px 12px rgba(15,23,42,0.08)` (soft) |
| Hover          | `-translate-y-2` + `0 16px 0 #1e293b`        | `-translate-y-4px` + `--shadow-xl`   |

### Buttons

| Property       | V5                                            | V6                                   |
|----------------|-----------------------------------------------|--------------------------------------|
| Style          | `box-shadow: 0 5px 0 #1e293b` (3D press)     | Flat with subtle glow shadow         |
| Border radius  | `18px`                                        | `12px` (`--radius-md`)               |
| Text           | ALL CAPS, 900 weight                          | Title Case, 700 weight               |
| Active state   | `translateY(3px)` (push down)                 | `translateY(0)` (settle)             |

### Typography

| Element        | V5                                  | V6                                |
|----------------|-------------------------------------|-----------------------------------|
| Headings       | All caps, 900 weight, text-shadow   | Title case, 800 weight, no shadow |
| Body text      | 700+ weight everywhere              | 400-500 for body, 600-700 for emphasis |
| Labels         | ALL CAPS TRACKING-WIDEST            | Uppercase but less aggressive tracking |

### Navigation

| Property       | V5                                  | V6                                |
|----------------|-------------------------------------|-----------------------------------|
| Height         | 72px                                | 64px                              |
| Background     | Solid white + `border-bottom: 4px`  | Glassmorphic blur + 1px border    |
| Mobile menu    | Full overlay with sections          | Slide-in panel with smooth animation |

### Animations

| Property       | V5                                  | V6                                |
|----------------|-------------------------------------|-----------------------------------|
| Entry          | `pop-in` (scale 0.5→1.1→1)         | `pop-in` (scale 0.95→1, subtler)  |
| Blobs          | `blob-spin` (rotate+skew, 12s)     | `float` (gentle bob, 20s)         |
| Decorations    | Floating emoji bubbles everywhere   | Mesh gradient blobs, no floating emojis on interactive surfaces |
| Glow           | `pulse-glow` (scale + glow, 2s)    | `tag-pulse` (subtle ring, 2s)     |

### Answer Colors (Game Screen)

| Answer | V5 Surface       | V5 Border   | V6 Surface        | V6 Border   |
|--------|-------------------|-------------|--------------------|-------------|
| A      | `#fff1f3`         | `#de5e76`   | `#fff1f2`          | `#e11d48`   |
| B      | `#eef5ff`         | `#2d7ff0`   | `#eff6ff`          | `#2563eb`   |
| C      | `#fff8e1`         | `#d39b18`   | `#fffbeb`          | `#d97706`   |
| D      | `#ecfdf5`         | `#1f9d6c`   | `#ecfdf5`          | `#059669`   |

---

## Removed V5 Patterns

These V5 patterns are no longer used and should not be reintroduced:

1. **Hard 3D borders** (`box-shadow: 0 Xpx 0 #1e293b`) — replaced by soft elevation shadows
2. **text-shadow on headings** (`text-shadow: 4px 4px 0 #fff`) — removed entirely
3. **Floating emoji decorations** on gameplay surfaces — removed from game/study/join pages
4. **Inline utility class definitions** in `<style jsx>` blocks — moved to globals.css
5. **`.glow-accent` / `.glow-warning`** classes — replaced by `--shadow-glow-*` tokens
6. **`.animate-blob-spin`** — replaced by gentler `.mesh-blob` system
7. **ALL CAPS EVERYWHERE** — now used only for small labels/tags, not headings

---

## Migration Notes for Developers

### If you had custom components using V5 classes:

| V5 Class/Pattern                   | V6 Replacement                              |
|------------------------------------|---------------------------------------------|
| `border: 3px solid #1e293b`        | `border: 1px solid var(--line)`             |
| `box-shadow: 0 8px 0 #1e293b`     | `box-shadow: var(--shadow-md)`              |
| `box-shadow: 0 16px 0 #1e293b`    | `box-shadow: var(--shadow-xl)`              |
| `border-radius: 24px`             | `border-radius: var(--radius-xl)`           |
| `font-weight: 900` (on body text) | `font-weight: 500` or `600`                 |
| `text-transform: uppercase` (on headings) | Remove, use natural case             |
| `color: var(--border-dark)`        | `color: var(--ink)`                         |
| `background: var(--accent-light)`  | Same (token preserved)                      |
| `.btn-action`                      | `.btn .btn-primary` or `.btn .btn-accent`   |
| `.glass-panel`                     | `.glass` or `.glass-strong`                 |
| `.animate-blob-spin`               | `.mesh-blob` system                         |
| `.animate-pulse-glow`              | `.animate-pulse-soft` or `.tag-live`        |
| `.animate-pop-in` (bouncy)         | `.animate-pop-in` (smooth, same class name) |

### CSS variable renames:

| V5 Variable               | V6 Variable            |
|----------------------------|------------------------|
| `--background`             | `--bg`                 |
| `--ink-secondary`          | `--ink-secondary` (same)|
| `--accent` (`#6d5df6`)    | `--accent` (`#7c3aed`) |
| `--primary` (`#de5e76`)   | `--primary` (`#e11d48`)|
| `--success` (`#1f9d6c`)   | `--success` (`#059669`)|
| `--warning` (`#f2c14b`)   | `--warning` (`#d97706`)|

---

## Known Limitations (Unchanged from V5)

These are product limitations, not V6 bugs:

1. No cross-device multiplayer (localStorage only)
2. No backend / authentication / cloud persistence
3. AI quiz generation is simulated (mock progress animation)
4. "From PDF" and "From URL" quiz sources show "Coming Soon"
5. "Weak Spots" and "Adaptive AI" study modes redirect to Flashcards
6. Achievements are calculated client-side, not persisted separately
7. Study streak can be manipulated by changing system clock

---

## What to Build Next

Priority recommendations for the engineering team:

1. **Backend integration** — Replace `lib/store.ts` with Supabase. See `BACKEND_ARCHITECTURE.md`.
2. **Real-time multiplayer** — Replace localStorage polling with Supabase Realtime or WebSocket.
3. **Authentication** — Add sign-up/login with Supabase Auth. Profile becomes server-side.
4. **Real AI generation** — Connect quiz creation to an LLM API for actual question generation.
5. **Weak Spots study mode** — Track which questions users get wrong and surface them for targeted review.
6. **Analytics dashboard** — Track quiz plays, completion rates, and popular categories.
