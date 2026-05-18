---
name: weweb-page-design
description: Orchestrator-style workflow for building or redesigning a full WeWeb page (landings, dashboards, multi-block layouts). Load when the request involves more than 1-2 element mutations — e.g. "design a landing", "redesign the home page", "build a hero + features + CTA layout". Mirrors how weweb-ai's frontend mode decomposes a design brief.
metadata:
  type: weweb
---

# Designing a full WeWeb page

Building a page is not one big command — it's a **PLAN → APPLY → VERIFY** loop, repeated per top-level block. The single biggest reason CLI-based page designs fail is sending one giant `--data` payload with deeply nested children and expecting the server to recurse: **it doesn't**. Only the top level is created; nested arrays are dropped.

This skill teaches the loop and the canonical content shape. It assumes you've already loaded `weweb-pages` and `weweb-element-types`.

## The loop

For each top-level block (hero, features, CTA, footer, …):

1. **PLAN** — write out the operations for this block as a numbered list before running any CLI command:
   1. Add the section (`tag: ww-section`, parent = pageId, slot = `wwObjects`). Note the new section uid you'll get back.
   2. Add direct children of the section (slot = `wwObjects`). Use one `elements add` call with a `--data` array containing all siblings.
   3. If a child is a layout container (`ww-div` for a row of buttons, a 3-column card grid, …), initialize it with `content.default.children: []` plus the right `_ww-layout_*` props so it can accept children, then add its children in a separate call.
   4. Edit individual props with `weweb elements edit --path=content.default.<prop>` for anything you didn't set inline.
2. **APPLY** — run the operations sequentially. Capture each new uid from the `--json` response (or `weweb elements list --page-id=<p> --json` immediately after). Never paste a uid into a downstream call without verifying it exists.
3. **VERIFY** — after the block is done: `weweb pages get <pageId>` and confirm the new section + its key children are present with the expected `name`s and content. If anything is missing or under the wrong parent, fix it before moving to the next block.

Don't try to "save commands" by skipping VERIFY — the cost of building three more blocks on top of a wrong parent is much higher than a one-second re-read.

## Why sections, not nested divs

`ww-section` is the only top-level container at depth 0 on a page. Multi-block landings ARE multiple sections — one per visually distinct band (hero, features, testimonials, pricing, CTA, footer). This buys you:

- Per-block `backgroundColor` / gradients without coordinating overflow
- Per-block padding without conflicting margins
- Per-block min-height for "fill the viewport" hero patterns
- Cleaner per-block flex layout (sections are flex containers by default — set `_ww-layout_flexDirection`, `_ww-layout_alignItems`, etc.)

Use `ww-div` inside a section for sub-rows / columns / cards where you need a different flex direction than the section uses.

## Adding a new top-level section to a page

```bash
weweb elements add \
  --page-id="$PAGE" \
  --parent-id="$PAGE" \
  --slot=wwObjects \
  --data '[
    {
      "tag": "ww-section",
      "name": "Hero",
      "_state": {
        "style": {
          "default": {
            "backgroundColor": "var(--ww-color-bg-emphasis)",
            "padding": "var(--ww-spacing-12) var(--ww-spacing-06)",
            "minHeight": "100vh"
          }
        }
      },
      "content": {
        "default": {
          "_ww-layout_flexDirection": "column",
          "_ww-layout_alignItems": "center",
          "_ww-layout_justifyContent": "center",
          "_ww-layout_rowGap": "var(--ww-spacing-06)"
        }
      }
    }
  ]'
```

**Note the split**: `_state.style.default.*` for raw CSS (background, padding, sizing); `content.default._ww-layout_*` for flex behavior.

`--parent-id` is the **pageId** for new top-level sections — the back's `getAddElementsActions` detects `parentType === 'page' && tag === 'ww-section'` and creates a real section record. Capture the new section uid for the next step.

## Adding children inside a section

```bash
weweb elements add \
  --page-id="$PAGE" \
  --parent-id="$SECTION" \
  --slot=wwObjects \
  --data '[
    {
      "tag": "ww-text",
      "name": "Eyebrow",
      "content": {
        "default": {
          "tag": "p",
          "_ww-text_text": { "en": "✨ Welcome" },
          "_ww-text_fontSize": "var(--ww-text-body-sm-font-size)",
          "_ww-text_color": "var(--ww-color-content-brand)",
          "_ww-text_textTransform": "uppercase",
          "_ww-text_letterSpacing": "0.15em"
        }
      }
    },
    {
      "tag": "ww-text",
      "name": "Headline",
      "content": {
        "default": {
          "tag": "h1",
          "_ww-text_text": { "en": "Build beautiful sites without code." },
          "_ww-text_fontSize": "var(--ww-text-display-lg-font-size)",
          "_ww-text_fontWeight": "800",
          "_ww-text_color": "var(--ww-color-content-primary-inverted)",
          "_ww-text_lineHeight": "1.05",
          "_ww-text_letterSpacing": "-0.04em"
        }
      }
    }
  ]'
```

One call per parent, all siblings in the array.

## Adding a sub-row (ww-div) and then its children

A bare `ww-div` doesn't accept children until its `content.default.children` array exists. Create the div with the array initialized, then add the children in a second call.

```bash
# 1. Create the row container
weweb elements add \
  --page-id="$PAGE" \
  --parent-id="$SECTION" \
  --slot=wwObjects \
  --data '[
    {
      "tag": "ww-div",
      "name": "CTA row",
      "content": {
        "default": {
          "children": [],
          "_ww-layout_flexDirection": "row",
          "_ww-layout_columnGap": "var(--ww-spacing-04)",
          "_ww-layout_alignItems": "center",
          "_ww-layout_justifyContent": "center"
        }
      }
    }
  ]'

# 2. Capture the div uid, then add the buttons
weweb elements add \
  --page-id="$PAGE" \
  --parent-id="$CTA_ROW_UID" \
  --slot=children \
  --data '[
    {
      "tag": "ww-button",
      "name": "Primary CTA",
      "_state": {
        "style": {
          "default": {
            "backgroundColor": "var(--ww-color-bg-brand)",
            "padding": "var(--ww-spacing-03) var(--ww-spacing-05)",
            "borderRadius": "var(--ww-border-radius-03)",
            "cursor": "pointer"
          }
        }
      },
      "content": {
        "default": {
          "_ww-text_text": { "en": "Start free" },
          "_ww-text_color": "var(--ww-color-content-primary-inverted)"
        }
      }
    },
    {
      "tag": "ww-button",
      "name": "Secondary CTA",
      "_state": {
        "style": {
          "default": {
            "backgroundColor": "transparent",
            "border": "1px solid var(--ww-color-border-default)",
            "padding": "var(--ww-spacing-03) var(--ww-spacing-05)",
            "borderRadius": "var(--ww-border-radius-03)",
            "cursor": "pointer"
          }
        }
      },
      "content": {
        "default": {
          "_ww-text_text": { "en": "Watch demo" }
        }
      }
    }
  ]'
```

## Style cheat-sheet — where does this property go?

There are two storage homes on the element. Pick by property group:

| Want | Path | Notes |
|---|---|---|
| Set text content | `content.<state>._ww-text_text` (i18n: `{ "en": "..." }`) | Plus `_ww-text_sanitize` |
| Typography (size/weight/color/lineHeight/letterSpacing/textAlign/textTransform/textShadow/textDecoration*) | `content.<state>._ww-text_<prop>` | e.g. `_ww-text_fontSize` |
| Flex layout (flexDirection/justifyContent/alignItems/rowGap/columnGap/flexWrap) | `content.<state>._ww-layout_<prop>` | Container properties |
| Grid layout (columns/rows/columnGap/rowGap/flowDirection) | `content.<state>._ww-grid_<prop>` | When `display: grid` |
| **Background** (backgroundColor/backgroundGradient/backgroundImage/backgroundSize/backgroundRepeat/backgroundPosition*) | **`_state.style.<state>.<cssProp>`** | Raw CSS — note the leading `_state.` |
| **Spacing / sizing** (padding/margin/width/height/minHeight/maxHeight/aspectRatio) | **`_state.style.<state>.<cssProp>`** | Raw CSS |
| **Border / shadow** (border/borderTop/borderBottom/borderLeft/borderRight/borderRadius/outline/boxShadow) | **`_state.style.<state>.<cssProp>`** | Raw CSS |
| **Display / position** (display/position/top/right/bottom/left/zIndex/overflow/cursor/transform/opacity/transition) | **`_state.style.<state>.<cssProp>`** | Raw CSS |

> **Why two places?** The Sequelize models for `WwObject` and `Section` have two JSONB columns: `content` (element-specific, prefixed) and `_state` (everything else). The renderer reads typography/layout from `content.*._ww-{group}_*` and raw CSS from `_state.style.*.*`. There is no top-level `style` column — `--path=style.default.*` is silently dropped.

If a property you need isn't listed: `weweb elements describe <tag>` returns the bundled schema (synced from weweb-ai). If you still need it and `describe` doesn't surface it, fall back to reading an existing instance: `weweb elements list --page-id=<p> --uids=<existingUid> --json`.

## Working with existing content

If the page already has a section with stale content:
- Prefer **delete-and-re-add** when the entire block is wrong (delete all children, then run the loop for that block).
- Prefer **`weweb elements edit --path=content.default.<prop> --value=<v>`** when only a few props need updating.
- Use `weweb elements replace <uid> --data '[{...}]'` for atomic single-element swaps (one element in, one element out, same uid slot).

To clear an invalid content prop (like a wrong-prefix key you accidentally set), edit it to `null` or an empty string — Sequelize will rewrite the JSONB blob and the renderer will ignore the unknown key thereafter.

## Design tokens first

Before hardcoding colors / spacing / typography, try:

```bash
weweb design-system get --json
```

If it returns 400 / empty (e.g. a fresh local back without seeded tokens), fall back to literal CSS values but note this in the final report so the user can convert to tokens later. **Never invent token names** — only reference tokens that `design-system get` confirms exist.

## End-to-end example: a four-block landing page

Goal: rebuild a page as hero + features + CTA + footer.

```
PLAN
  block 1 — Hero section
    add section (parent=$PAGE, slot=wwObjects)
    add 4 children to section (eyebrow, headline, sub, CTA row div)
    add 2 buttons to the CTA row div
  block 2 — Features section
    add section (parent=$PAGE, slot=wwObjects, previous=$HERO)
    add section header (heading + sub)
    add a grid div (display: grid, _ww-grid_columns)
    add 3 feature cards as children of the grid div
  block 3 — Final CTA section
    add section (parent=$PAGE, slot=wwObjects, previous=$FEATURES)
    add heading + sub + button
  block 4 — Footer section
    add section (parent=$PAGE, slot=wwObjects, previous=$CTA)
    add 1-2 small-text elements

APPLY  — run each block's commands top-to-bottom, capture uids
VERIFY — `weweb pages get $PAGE` after each block
```

When all four blocks are done: re-read the page semantic, confirm 4 sections and the expected children, and ask the user to open the page in the WeWeb editor for a visual spot-check.

## Pitfalls (specific to multi-section design)

- **One section, multi-purpose: don't.** Trying to fit a hero + features + CTA into one section flex column means every child shares the same gap, background, alignment. The blocks fight each other. Use one section per visual band.
- **`--previous-id` for section ordering.** Without it, new sections insert at the *beginning* of the page. Pass `--previous-id=<prevSectionUid>` to append after a specific section. (Defaults to "start" — verify ordering with `weweb pages get` after every add.)
- **Don't pre-generate uids unless you need them.** The CLI fills missing `uid` fields with fresh UUIDs and returns them. Pre-generating only helps when you need a uid in a sibling element's binding or a same-call cross-reference (use `❖my-fake-id❖` placeholders for that case).
- **Re-read after delete.** `weweb elements delete <uid>` reports success even when the uid no longer exists. After a batch of deletes, `weweb pages get` to confirm the section is empty before re-populating.
