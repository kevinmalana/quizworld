# Historical Note

This design system document belongs to the older V6 pass.
It is useful for visual reference, but not as the current product architecture guide.

# QuizWorld V6 Design System

> The single source of truth for all visual decisions in QuizWorld.
> Every color, spacing value, shadow, and animation referenced in this project comes from this system.

---

## 1. Color Palette

All colors are defined as CSS custom properties in `app/globals.css` under `:root`.

### Backgrounds & Surfaces

| Token            | Hex       | Usage                                  |
|------------------|-----------|----------------------------------------|
| `--bg`           | `#f8f9fc` | Page background                        |
| `--bg-subtle`    | `#f1f3f9` | Hover states, secondary backgrounds    |
| `--surface`      | `#ffffff` | Cards, modals, panels                  |
| `--surface-raised`| `#ffffff`| Elevated cards (same, differentiated by shadow) |

### Text

| Token              | Hex       | Usage                                |
|--------------------|-----------|--------------------------------------|
| `--ink`            | `#0f172a` | Primary headings and body text       |
| `--ink-secondary`  | `#334155` | Secondary text, descriptions         |
| `--muted`          | `#64748b` | Labels, captions, helper text        |
| `--faint`          | `#94a3b8` | Placeholders, disabled text          |

### Accent — Electric Violet (Brand Primary)

| Token              | Value                        | Usage                            |
|--------------------|------------------------------|----------------------------------|
| `--accent`         | `#7c3aed`                    | Primary buttons, links, active   |
| `--accent-hover`   | `#6d28d9`                    | Button hover state               |
| `--accent-light`   | `#ede9fe`                    | Active badges, highlight bg      |
| `--accent-glow`    | `rgba(124, 58, 237, 0.15)`  | Focus rings, box-shadow glow     |

### Semantic Colors

| Role      | Token         | Hex       | Light Surface         |
|-----------|---------------|-----------|-----------------------|
| Primary   | `--primary`   | `#e11d48` | `--primary-light` `#fff1f2` |
| Secondary | `--secondary` | `#2563eb` | `--secondary-light` `#eff6ff` |
| Success   | `--success`   | `#059669` | `--success-light` `#ecfdf5` |
| Warning   | `--warning`   | `#d97706` | `--warning-light` `#fffbeb` |

### Answer Colors (Game & Study Screens)

These are the four answer-button colors used in quiz gameplay and study quick-fire mode:

| Answer | Token         | Color     | Surface Token          | Surface   |
|--------|---------------|-----------|------------------------|-----------|
| A      | `--answer-a`  | `#e11d48` | `--answer-a-surface`   | `#fff1f2` |
| B      | `--answer-b`  | `#2563eb` | `--answer-b-surface`   | `#eff6ff` |
| C      | `--answer-c`  | `#d97706` | `--answer-c-surface`   | `#fffbeb` |
| D      | `--answer-d`  | `#059669` | `--answer-d-surface`   | `#ecfdf5` |

### Borders

| Token            | Hex       | Usage                                |
|------------------|-----------|--------------------------------------|
| `--line`         | `#e2e8f0` | Default card/section borders         |
| `--line-strong`  | `#cbd5e1` | Emphasized borders, dividers         |
| `--border-dark`  | `#1e293b` | High-contrast borders (rare in v6)   |

---

## 2. Typography

### Font Families

| Token            | Stack                                                  | Usage                    |
|------------------|--------------------------------------------------------|--------------------------|
| `--font-body`    | `"DM Sans", "Inter", system-ui, -apple-system, sans-serif` | Body text, inputs, paragraphs |
| `--font-display` | `"Plus Jakarta Sans", "Inter", system-ui, sans-serif`  | Headings, labels, buttons, stats |

Both fonts are loaded from Google Fonts in `app/layout.tsx`.

### Weight Scale

- `400` — Body text
- `500` — Medium emphasis (descriptions, secondary labels)
- `600` — Semi-bold (navigation items)
- `700` — Bold (buttons, card titles)
- `800` — Extra-bold (page headings, hero text)

### Usage Pattern

Apply `.font-display` class (or `fontFamily: var(--font-display)`) to any heading, stat number, button label, or badge. All other text inherits `--font-body` from the `body` element.

---

## 3. Spacing Scale

| Token         | Value     | px    |
|---------------|-----------|-------|
| `--space-xs`  | `0.25rem` | 4px   |
| `--space-sm`  | `0.5rem`  | 8px   |
| `--space-md`  | `1rem`    | 16px  |
| `--space-lg`  | `1.5rem`  | 24px  |
| `--space-xl`  | `2rem`    | 32px  |
| `--space-2xl` | `3rem`    | 48px  |
| `--space-3xl` | `4rem`    | 64px  |

---

## 4. Border Radius

| Token            | Value   |
|------------------|---------|
| `--radius-sm`    | `8px`   |
| `--radius-md`    | `12px`  |
| `--radius-lg`    | `16px`  |
| `--radius-xl`    | `20px`  |
| `--radius-2xl`   | `24px`  |
| `--radius-full`  | `9999px`|

Cards use `--radius-xl` (20px). Buttons use `--radius-md` (12px). Tags/badges use `--radius-full`.

---

## 5. Shadows

| Token                  | Value                                            | Usage                  |
|------------------------|--------------------------------------------------|------------------------|
| `--shadow-sm`          | `0 1px 2px rgba(15,23,42,0.05)`                 | Subtle surface lift    |
| `--shadow-md`          | `0 4px 12px rgba(15,23,42,0.08)`                | Default cards          |
| `--shadow-lg`          | `0 8px 24px rgba(15,23,42,0.10)`                | Elevated cards, modals |
| `--shadow-xl`          | `0 16px 48px rgba(15,23,42,0.12)`               | Hover-lifted cards     |
| `--shadow-glow-accent` | `0 0 0 1px var(--accent), 0 4px 16px var(--accent-glow)` | Focus/active accent glow |
| `--shadow-glow-success`| `0 0 0 1px var(--success), 0 4px 16px var(--success-glow)` | Success state glow     |

**V5 → V6 change:** Removed all heavy cartoon `box-shadow: 0 8px 0 #1e293b` 3D borders. Everything now uses soft, multi-layered elevation shadows.

---

## 6. Component Classes

### Cards

| Class           | Behavior                                              |
|-----------------|-------------------------------------------------------|
| `.card`         | White surface, 1px border, `--radius-xl`, `--shadow-md`, overflow hidden |
| `.card-hover`   | Adds `translateY(-4px)` + `--shadow-xl` on hover      |
| `.card-elevated`| Same as card but starts with `--shadow-lg`             |

### Buttons

| Class           | Style                                                  |
|-----------------|--------------------------------------------------------|
| `.btn`          | Base: flex, centered, rounded, font-display, 700 weight |
| `.btn-primary`  | Violet bg, white text, accent glow shadow              |
| `.btn-secondary`| White bg, dark text, 1.5px border                      |
| `.btn-accent`   | Amber gradient bg, dark text                           |
| `.btn-ghost`    | Transparent, muted text                                |
| `.btn-sm`       | Smaller padding + font                                 |
| `.btn-lg`       | Larger padding + font                                  |
| `.btn-xl`       | Extra large (hero CTAs)                                |

### Inputs

| Class       | Style                                                    |
|-------------|----------------------------------------------------------|
| `.input`    | Full width, 1.5px border, `--radius-md`, accent focus ring |
| `.input-lg` | Larger padding + font                                    |
| `.input-pin`| Centered, display font, wide letter-spacing, 2px border  |

### Tags/Badges

| Class          | Style                                   |
|----------------|-----------------------------------------|
| `.tag`         | Pill-shaped base tag                     |
| `.tag-accent`  | Violet tint                              |
| `.tag-success` | Green tint                               |
| `.tag-primary` | Rose tint                                |
| `.tag-warning` | Amber tint                               |
| `.tag-secondary`| Blue tint                               |
| `.tag-live`    | Solid green, pulsing animation           |

### Layout Grids

| Class    | Columns                                |
|----------|----------------------------------------|
| `.grid-2`| 1col → 2col at 640px                   |
| `.grid-3`| 1col → 2col at 640px → 3col at 1024px |
| `.grid-4`| 1col → 2col at 640px → 4col at 1024px |

---

## 7. Animations

| Class                   | Keyframes       | Duration | Use                        |
|-------------------------|-----------------|----------|----------------------------|
| `.animate-float`        | `float`         | 3.5s     | Decorative bobbing         |
| `.animate-float-reverse`| `float-reverse` | 4s       | Counter-bobbing            |
| `.animate-pop-in`       | `pop-in`        | 0.4s     | Entry reveal (scale 0.95→1)|
| `.animate-slide-up`     | `slide-up`      | 0.5s     | Entry from below           |
| `.animate-pulse-soft`   | `pulse-soft`    | 2s       | Subtle breathing opacity   |
| `.animate-shimmer`      | `shimmer`       | 2s       | Loading shimmer effect     |

All animations respect `prefers-reduced-motion: reduce`.

---

## 8. Background Decorations

### Mesh Gradient Blobs

Used on the home page and other marketing surfaces for subtle depth:

```html
<div class="mesh-gradient">
  <div class="mesh-blob mesh-blob-1" />
  <div class="mesh-blob mesh-blob-2" />
  <div class="mesh-blob mesh-blob-3" />   <!-- optional -->
</div>
```

These are `position: fixed`, `z-index: -1`, `pointer-events: none` — they sit behind all content.

### Dot Pattern

```html
<div class="dot-pattern" style="position: absolute; inset: 0;" />
```

---

## 9. Utility Classes

| Class              | Effect                                             |
|--------------------|----------------------------------------------------|
| `.text-gradient`   | Purple-to-blue gradient text (brand headings)      |
| `.text-gradient-warm` | Rose-to-amber gradient text                     |
| `.border-gradient` | Double-border gradient (accent to secondary)       |
| `.glass`           | Backdrop-blur 20px, white 80% opacity              |
| `.glass-strong`    | Backdrop-blur 24px, white 92% opacity              |
| `.glass-dark`      | Backdrop-blur 20px, dark 75% opacity               |

---

## 10. Design Principles (V6)

1. **Clarity over decoration.** Every element earns its place. No gratuitous 3D shadows or floating emojis on gameplay surfaces.

2. **Soft elevation, not hard borders.** Cards lift with layered shadows instead of thick `border + box-shadow` combos.

3. **Color for meaning.** Answer A is always rose, B is always blue, C is always amber, D is always green — across game, create, and study screens.

4. **Readability under pressure.** Question and answer text is always dark-on-light. Timer states use green → amber → rose progression.

5. **Marketing surfaces can be expressive.** The homepage hero, CTA banners, and explore page can use gradients, mesh blobs, and animated elements. Gameplay surfaces stay calm.

6. **One font for flair, one for function.** Plus Jakarta Sans (display font) is used for headings, stats, and labels. DM Sans (body font) is used for everything else.

7. **Motion with purpose.** Animations are short (0.15s–0.5s), eased, and respect reduced-motion preferences. No infinite spinning or bouncing on interactive elements.
