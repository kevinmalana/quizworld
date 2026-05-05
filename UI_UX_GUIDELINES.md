# Historical Note

This file is a legacy design reference, not the current deployment or architecture guide.
Use [docs/HANDBOOK.md](./docs/HANDBOOK.md) for the current app summary.

# QuizWorld UI/UX Guidelines

## Overview

QuizWorld uses a playful, high-energy UI, but the current direction is **not** "max intensity everywhere".

The `v5` UI pass established a more balanced rule:

- marketing and browsing surfaces can feel expressive
- question, answer, and study surfaces must prioritize readability first

The app should feel:

- energetic
- mobile-friendly
- touch-first
- high-contrast
- readable under time pressure

## Current visual direction

The codebase now uses a **calmer game UI** rather than the earlier ultra-loud concept.

The theme still keeps:

- bold typography
- playful color identity
- rounded cards and buttons
- animated decorative background elements

But it now reduces:

- overly saturated fills behind important text
- heavy shadow depth on every element
- exaggerated motion on key decision surfaces
- reliance on white text over bright answer colors

## Core tokens and variables

Defined in [`app/globals.css`](./app/globals.css).

### Main surface tokens

- `--background`: app background
- `--surface`: card background
- `--ink`: primary text
- `--ink-secondary`: secondary text
- `--muted`: subdued UI text
- `--line`: soft border color
- `--border-dark`: strong outline color

### Brand/status tokens

- `--accent`
- `--accent-shadow`
- `--accent-light`
- `--primary`
- `--secondary`
- `--success`
- `--warning`

### Typography

- body: `DM Sans`
- display/headings: `Plus Jakarta Sans`

## Interaction rules

### 1. Question readability comes first

On gameplay and study screens:

- question text should sit on light, neutral surfaces
- primary text should be dark
- avoid large paragraphs on saturated backgrounds
- avoid white body text unless the background is genuinely dark enough

### 2. Answer buttons should not depend on color alone

Answer states must be understandable through:

- border changes
- icons/labels
- layout emphasis
- selection checkmarks
- opacity changes

Do not rely only on bright fill colors to communicate state.

### 3. Bright color should support structure, not replace it

Use accent colors for:

- category chips
- badges
- small labels
- selected states
- CTA emphasis

Do not use saturated fills for long text blocks when a neutral card would be clearer.

### 4. Motion should not interfere with answering

Background motion is acceptable if it stays subtle.

On decision-heavy screens:

- reduce movement near question and answer areas
- avoid strong pulsing on every CTA
- keep timers readable without visual noise
- ensure `prefers-reduced-motion` is respected

## Component guidance

### Buttons

Buttons remain chunky and tactile, but should now use:

- moderate shadow depth
- smaller active translation
- strong contrast
- less exaggerated rotation on hover

### Cards

Cards should keep:

- strong shape
- clear borders
- visual separation

But they should avoid:

- overly deep stacked shadows everywhere
- unnecessary tilt/rotation on hover for critical flows

### Inputs

PIN and nickname inputs should:

- stay large and thumb-friendly
- preserve dark readable text
- use visible focus rings
- avoid over-the-top transform effects on focus

## High-priority screens

These screens should always be treated as the strictest accessibility/readability surfaces:

- [`app/game/[pin]/page.tsx`](./app/game/[pin]/page.tsx)
- [`app/study/[id]/page.tsx`](./app/study/[id]/page.tsx)
- [`app/join/page.tsx`](./app/join/page.tsx)
- [`app/create/page.tsx`](./app/create/page.tsx)

## v5 readability changes

The `v5` pass specifically improved:

- global palette balance in [`app/globals.css`](./app/globals.css)
- game answer readability in [`app/game/[pin]/page.tsx`](./app/game/[pin]/page.tsx)
- reveal/final leaderboard legibility in [`app/game/[pin]/page.tsx`](./app/game/[pin]/page.tsx)
- study answer readability in [`app/study/[id]/page.tsx`](./app/study/[id]/page.tsx)

## Rules for future AI agents

1. Do not revert gameplay and study screens back to full saturated answer cards with white text everywhere.
2. Do not increase motion intensity on screens where users need to read and answer quickly.
3. Do not make correctness depend only on color.
4. Do not introduce low-contrast muted text on colored backgrounds.
5. Keep expressive visuals mostly in hero, discovery, and celebration surfaces.
6. Keep decision surfaces calmer than marketing surfaces.

## Practical standard

If a user has 5 seconds left to answer on a phone, the interface should feel:

- obvious
- readable
- low-friction

If a visual treatment makes the answer harder to read, it is the wrong treatment even if it looks more exciting.
