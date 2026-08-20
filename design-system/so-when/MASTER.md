# Design System Master File

> **LOGIC:** When building a specific page, first check `pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** So, When?
**Source:** ui-ux-pro-max (`nextlevelbuilder`) + Palari Labs brand constraints  
**Category:** Lifestyle / friendship productivity (calendar-first)  
**Stack:** Expo React Native + NativeWind  
**Design Dials:** Variance 3/10 · Motion 4/10 · Density 4/10

---

## Brand overrides (must keep)

ui-ux-pro-max suggested calendar blue (`#2563EB`). **So, When? keeps Palari teal** so the product stays on-brand:

| Role | Hex | Token |
|------|-----|-------|
| Primary | `#147A78` | `primary` |
| Primary pressed | `#0F6261` | `primary-pressed` |
| Soft primary | `#E7F5F4` | `primary-soft` |
| Accent / warmth | `#F28C78` | `coral` |
| Canvas (warm off-white) | `#FAF8F5` | `canvas` |
| Surface | `#FFFFFF` | `surface` |
| Ink | `#2A2C31` | `ink` |
| Muted | `#6B7280` | `muted` |
| Border (warm) | `#EBE5DF` | `border` |
| Success | `#15803D` | `success` |
| Danger | `#B42318` | `danger` |

Keep `tailwind.config.js` and `src/foundation.ts` in sync.

## Surfaces & shape

- Radii: `control` 14 · `card` 20 · `sheet` 24 · buttons and bottom nav are pills (`rounded-full`)
- Primary surfaces use **soft teal-tinted shadows** (`shadowSoft` / `shadowLift` in `src/foundation.ts`) instead of hard borders; borders stay for inputs and secondary UI
- One `shadowLift` card per screen max (the focused plan card)
- Standard primitives: `Card` (white surface + soft shadow), `PressableScale` (0.97 calm press feedback), `AnimatedDialog` (bottom sheet), `ScreenTransition` (220ms fade+rise between screens)

## Flow patterns

- Tap free slot → animated invite sheet (`InviteSheet`), not a hard route jump
- Status pickers and post-share confirmations are `AnimatedDialog` sheets, never raw `Modal`/`Alert`
- Navigation is a back stack in `AppProvider`: `open*` pushes, `goBack()` pops, hardware back is wired; tab switches reset to the tab root

## Typography

- **UI / body / headings:** Quicksand (warm, friendly, readable on calendar)
- **Avoid** Caveat on schedule UI (handwriting harms density/legibility)
- Base size ≥ 16px body; chip labels ≥ 11–12px; line-height ~1.5

## Icons

- Outline vector icons only (`@expo/vector-icons` Feather) — **no emoji as icons**
- Tab icons: calendar, users
- Controls: chevron-left/right, x, plus, arrow-left
- Icon buttons: min 44×44pt tap area (`hitSlop` if glyph is smaller)

## Motion

- Micro-interactions 150–300ms
- Dialog: open 250ms / close 150ms, opacity + transform only
- Respect reduce-motion
- Press feedback via opacity/scale without layout shift

## UX rules (from pro-max)

1. Accessibility labels on every interactive control  
2. Touch targets ≥ 44×44  
3. Bottom nav ≤ 2 items (Calendar, Friends)  
4. Predictable back from sheets/screens  
5. Color is never the only status cue (status text on invite chips)  
6. Modal scrim ~45–55% black  
7. Safe areas on headers, tabs, sheets  
8. 4/8dp spacing rhythm  

## Pattern

Minimal calendar-first: week/day/agenda switcher, free slots → invite sheet, friends list with last-met + priority.
