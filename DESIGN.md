# NEET Companion — Design System

**Style:** Flat Design Mobile (Touch-First). Light and dark, both first-class.
**Palette source:** shadcn preset `b84oyNnJ7Q` neutrals, with the brand lime as primary, `--radius: 0.875rem`.

**Superseded:** pure neumorphism (v1). Dropped once the app became data-dense: soft dual shadows gave no hierarchy across long result lists, capped contrast, blocked dark mode, and cost GPU time per row. A shadcn preset briefly supplied an amber primary; the neutrals were kept, the amber was not.

**Kept throughout:** Quantico display type, and the flat no-shadow architecture.

> **Note on the preset.** shadcn/ui itself cannot run here — it is React web, built on DOM elements, Radix primitives, and Tailwind classes, and has no React Native target (its templates are next / vite / react-router / astro / laravel only). Only the *token values* were ported. Two of them failed WCAG and were corrected; see below.

---

## 1. Principles

1. **No shadows.** `shadowOpacity: 0`, `elevation: 0`, no `boxShadow`. Hierarchy is fill, weight, spacing.
2. **Colour carries meaning.** Lime marks brand and selection. The tier scale marks confidence.
3. **One accent.** Tier colours are semantic, not accents.
4. **Both schemes always**, and every pairing measured.

---

## 2. Colour

Source of truth: [src/theme/index.ts](src/theme/index.ts). All ratios computed, not estimated.

### Light

| Token | Value | Preset var | On bg | On surface |
|---|---|---|---|---|
| `bg` | `#FFFFFF` | `--background` | — | — |
| `surface` | `#F4F4F5` | `--secondary` | — | — |
| `border` | `#E5E5E5` | `--border` | — | — |
| `text` | `#0A0A0A` | `--foreground` | 19.80 AAA | — |
| `textSecondary` | `#18181B` | `--secondary-foreground` | 18.1 AAA | — |
| `textMuted` | `#646464` | **corrected** | 5.92 AA | 5.38 AA |
| `accent` | `#7CCF00` | **brand lime** | fill only | — |
| `accentText` | `#3F6600` | **brand, darkened** | 6.75 AA | 6.14 AA |
| `onAccent` | `#12200A` | **brand** | 8.72 AAA on lime | — |

### Dark

| Token | Value | Preset var | On bg | On surface |
|---|---|---|---|---|
| `bg` | `#0A0A0A` | `--background` | — | — |
| `surface` | `#171717` | `--card` | — | — |
| `border` | `#27272A` | `--secondary` | — | — |
| `text` | `#FAFAFA` | `--foreground` | 18.97 AAA | — |
| `textMuted` | `#A1A1A1` | `--muted-foreground` | 7.66 AAA | 6.94 AA |
| `accent` | `#9AE600` | **brand lime** | fill only | — |
| `accentText` | `#9AE600` | **brand lime** | 12.91 AAA | 11.69 AAA |
| `onAccent` | `#12200A` | **brand** | 11.07 AAA on lime | — |

### Two corrections to the preset

The preset is not contrast-safe as shipped. Both defects were fixed, not inherited:

1. **`--muted-foreground` `#737373` measures 4.31 on the card surface — fails AA** for body text. Darkened to `#646464` (5.38).
2. **The preset's `--primary` was replaced entirely** by the brand lime from `logo-lime.png`. Lime has the same trap: raw `#7CCF00` as text on white measures 1.95 and fails, so light mode uses the darkened `#3F6600` (6.75). Dark mode can use `#9AE600` directly at 12.91.

**Never put white on the lime fill** — it measures 1.95 and fails outright. Use `onAccent` (`#12200A`), which measures 8.72 AAA.

### Tier scale

The preset ships only `--destructive`, so the confidence scale was built out. All pairings verified on their tinted badge backgrounds:

| Tier | Light | on tint | Dark | on tint |
|---|---|---|---|---|
| Safe | `#0E6B52` 6.47 AA | 5.53 AA | `#2DD4A7` 10.45 AAA | 8.41 AAA |
| Moderate | `#9A4A00` 6.26 AA | 5.49 AA | `#FDBA74` 11.74 AAA | 9.80 AAA |
| Reach | `#C10007` 6.42 AA | 5.43 AA | `#FF6467` 6.85 AA | 5.99 AA |

The brand is a green, so **Safe is a teal-green, never a lime-green** — otherwise selection and confidence read as the same signal. Moderate is a burnt orange for the same reason.

---

## 3. Typography

| Role | Family | Weights |
|---|---|---|
| Display, headings, labels | **Quantico** (local, OFL) | 400, 700 |
| Body, anything you read | **Inter** | 400, 500, 600 |

| Token | Size / Line | Family |
|---|---|---|
| `displayXl` | 52 / 54, tracking -1 | Quantico Bold |
| `displayL` | 34 / 38 | Quantico Bold |
| `h1` | 28 / 33 | Quantico Bold |
| `h2` | 19 / 24 | Quantico Bold |
| `label` | 11 / 14, tracking 1.2, uppercase | Quantico |
| `bodyL` | 17 / 26 | Inter 400 |
| `body` | 15 / 22 | Inter 600 |
| `bodyRegular` | 15 / 23 | Inter 400 |
| `bodySm` | 13 / 19 | Inter 400 |
| `caption` | 12 / 17 | Inter 500 |

Prose caps at 620px, keeping lines in the 65–75 character range.

---

## 4. Shape, spacing, motion

Radius derives from the preset's `--radius: 0.875rem` (14px): **`sm 10`, `md 14`, `lg 18`, `pill`**.

Spacing: `4, 8, 16, 24, 32, 48`. Touch targets minimum **48px**.

Motion is functional only: press feedback is an opacity change at 120ms. No springs, no bounce, no loops.

---

## 5. Components

| Component | Behaviour |
|---|---|
| `Surface` | `card` (surface + hairline), `accent` (solid lime), `outline`, `plain` |
| `Segmented` | Selected chip is a solid lime fill. `collapseAfter` hides overflow behind "+N more" and auto-expands if the selection is hidden |
| `Field` | Label above, hint or error below. Focus is a 2px accent border |
| `TabBar` | Solid, edge-anchored, hairline top. Active tab gets a 2px accent rule |
| `TierBadge` | Filled chip on the three-step confidence scale |
| `ThemeToggle` | One button cycling system → light → dark. Sits top-right of every screen header. Choice persists via AsyncStorage under `theme-mode` |

Theme resolution lives in `src/theme/ThemeProvider.tsx`. Tokens are in `src/theme/tokens.ts` and re-exported through `src/theme/index.ts`, so components keep importing from `@/theme` without a circular dependency.

---

## 6. Rules

- Never white text on the lime fill.
- Raw `accent` is never text in light mode; use `accentText`.
- Long lists page rather than render whole (`PAGE = 30`).
- `app.json` must keep `userInterfaceStyle: "automatic"`, otherwise native builds lock to light and dark mode never appears.
- Every new colour pairing gets measured before it ships.
