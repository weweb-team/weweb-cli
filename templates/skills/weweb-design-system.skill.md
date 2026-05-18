---
name: weweb-design-system
description: Design system — tokens (colors, spacing, typography), classes, subclasses, guidelines. Use BEFORE styling any element. Load whenever you'd consider hardcoding a color, padding, or font.
metadata:
  type: weweb
---

# Design system

WeWeb projects have a design system with **tokens** (named values) and **classes** (named style bundles). Always reference tokens by `var(--ww-…)` instead of hardcoding hex/px.

## Discover

```bash
weweb design-system get --json
```

Returns `{ fonts, sections, elements, styles, classes, components, componentsElements, guidelines }`. The two parts you'll use most:

- `styles` — tokens. Look for `colors`, `spacings`, `typography`, `borders`, `shadows`, etc.
- `classes` — reusable named style bundles you can apply to any element.

## Use tokens, not literals

Wrong: `style.default.color: "#0066ff"`
Right: `style.default.color: "var(--ww-color-bg-brand)"` (assuming `bg-brand` exists as a token)

If the exact token you need doesn't exist, prefer creating it over hardcoding:

```bash
weweb design-system tokens-create --json '{
  "id": "color-bg-brand-soft",
  "type": "color",
  "value": "#e6f0ff",
  "category": "colors"
}'
```

## Apply a class

Bind an element's `class` content property to a class id from `design-system get`. Classes are the right place to put "every button looks like this" — not inline `style`.

## Editing existing tokens

```bash
weweb design-system tokens-edit --json '{ "id": "color-bg-brand", "value": "#0055ee" }'
```

The change is system-wide. Every element that references this token re-renders.

## Subclasses

Subclasses are variants of a class (`button-primary`, `button-secondary`). Use them for "all primary buttons look like X". Manage them with `classes-create`, `subclasses-create`, etc.

## Guidelines

The `guidelines` blob contains free-form design rules the team wants the AI to follow. Read it before designing anything:

```bash
weweb design-system get --json | jq '.guidelines'
```

If a user asks "make this look more premium" — check guidelines first; they often encode the aesthetic direction.

## What to do and not to do

- **Do** read `design-system get` before styling anything new
- **Do** reference tokens via `var(--ww-…)` in `style` values
- **Do** apply existing classes via the element's `class` property
- **Do** create new tokens when the existing palette doesn't cover a need
- **Do not** hardcode colors, paddings, font sizes
- **Do not** invent token names that don't exist — read first, then create if missing
- **Do not** put one-off styles in a class — classes are for repeated patterns
