---
name: weweb-element-types
description: Element type schemas, content-property prefix rules, and friendly→prefixed name mappings. Load whenever constructing or editing an element JSON payload (ww-text, ww-button, ww-section, ww-div, ww-image, ww-input-*, ww-paginator, etc.).
metadata:
  type: weweb
---

# WeWeb element types

When you create or edit an element via `weweb elements add` / `weweb elements edit`, the element JSON has a strict shape — the property keys inside `content.default.*` are prefixed with the element's "group" namespace, not just the property name. Without prefixing the keys correctly, the API silently ignores them and the element renders with defaults.

## The shape

```json
{
  "tag": "ww-text",
  "name": "Headline",
  "content": {
    "default": {
      "tag": "h1",
      "_ww-text_text": { "en": "Hello world" },
      "_ww-text_fontSize": "48px",
      "_ww-text_color": "var(--ww-color-content-primary)"
    },
    "tablet": { "_ww-text_fontSize": "32px" },
    "mobile": { "_ww-text_fontSize": "24px" },
    "hover": { "_ww-text_color": "var(--ww-color-content-brand)" }
  }
}
```

Two important rules:
1. **Every property key inside `content.<state>` is prefixed** — see the prefix rules below.
2. **State/breakpoint inheritance**: `mobile` falls back to `tablet`, `tablet` falls back to `default`. So you only need to set a key on a breakpoint when it differs from the parent breakpoint.

## Prefix rule

The prefix depends on the *property group*, not always the element tag:

| Property group | Prefix | Applies to |
|---|---|---|
| Element-specific (most properties) | `_ww-<tag>_<prop>` | The element whose `tag` matches — e.g. `_ww-image_src`, `_ww-icon_name`, `_ww-input-basic_placeholder` |
| Text content & typography | `_ww-text_<prop>` | `ww-text` AND `ww-button` (button reuses the text content/style schema) |
| Flex layout | `_ww-layout_<prop>` | `ww-section`, `ww-div`, and any other layout container |
| Grid layout | `_ww-grid_<prop>` | Same containers when `display: grid` |

To learn an unfamiliar element type's exact property set: `weweb elements describe <tag>` prints its bundled schema (synced from weweb-ai). Or fetch an existing instance with `weweb elements list --page-id=<p> --uids=<existingUid>` to see a real payload from the project.

## Friendly→prefixed property name table

These are the friendly names the WeWeb in-editor AI uses internally, mapped to the prefixed API keys it actually sends. Use this table when constructing the `content.default.*` payload — write the prefixed key on the right.

> **Source of truth**: `weweb-docker/weweb-ai/src/core/modes/frontend/agents/uiLayout/uiLayout.services.ts:40-93`. Refresh this table when properties drift.

### Text content (`ww-text`, `ww-button`)

| Friendly name | API key |
|---|---|
| `text` | `_ww-text_text` |
| `sanitize` | `_ww-text_sanitize` |

### Text style (`ww-text`, `ww-button`)

| Friendly name | API key |
|---|---|
| `font` | `_ww-text_font` |
| `fontSize` | `_ww-text_fontSize` |
| `fontFamily` | `_ww-text_fontFamily` |
| `fontWeight` | `_ww-text_fontWeight` |
| `lineHeight` | `_ww-text_lineHeight` |
| `textAlign` | `_ww-text_textAlign` |
| `color` | `_ww-text_color` |
| `textDecoration` | `_ww-text_textDecoration` |
| `textDecorationStyle` | `_ww-text_textDecorationStyle` |
| `textDecorationColor` | `_ww-text_textDecorationColor` |
| `textTransform` | `_ww-text_textTransform` |
| `textShadow` | `_ww-text_textShadow` |
| `letterSpacing` | `_ww-text_letterSpacing` |
| `wordSpacing` | `_ww-text_wordSpacing` |
| `nowrap` | `_ww-text_nowrap` |
| `ellipsis` | `_ww-text_ellipsis` |

### Flex layout (`ww-section`, `ww-div`, …)

| Friendly name | API key |
|---|---|
| `flexDirection` | `_ww-layout_flexDirection` |
| `justifyContent` | `_ww-layout_justifyContent` |
| `alignItems` | `_ww-layout_alignItems` |
| `alignContent` | `_ww-layout_alignContent` |
| `rowGap` | `_ww-layout_rowGap` |
| `columnGap` | `_ww-layout_columnGap` |
| `flexWrap` | `_ww-layout_flexWrap` |

### Grid layout

| Friendly name | API key |
|---|---|
| `gridColumnGap` | `_ww-grid_columnGap` |
| `gridColumns` | `_ww-grid_columns` |
| `gridAutoFlow` | `_ww-grid_flowDirection` |
| `gridFlowDirection` | `_ww-grid_flowDirection` |
| `gridRowGap` | `_ww-grid_rowGap` |
| `gridRows` | `_ww-grid_rows` |
| `gridTemplateColumns` | `_ww-grid_columns` *(needs parsing)* |
| `gridTemplateRows` | `_ww-grid_rows` *(needs parsing)* |
| `columnGap` *(when display: grid)* | `_ww-grid_columnGap` |
| `rowGap` *(when display: grid)* | `_ww-grid_rowGap` |

### Standard CSS properties

Properties not in the prefixed tables above (`backgroundColor`, `backgroundGradient`, `padding`, `margin`, `borderRadius`, `boxShadow`, `width`, `height`, `minHeight`, `display`, `position`, `top`, `left`, `border`, `cursor`, …) are stored **on `_state.style.<breakpoint-or-state>`**, NOT on `content`. The `_state` JSONB column on the `WwObject` / `Section` Sequelize models is where the renderer reads CSS from. Element-specific content lives on `content`; raw CSS lives on `_state.style`.

```json
{
  "uid": "<uuid>",
  "tag": "ww-section",
  "_state": {
    "style": {
      "default": {
        "backgroundColor": "var(--ww-color-bg-brand)",
        "padding": "var(--ww-spacing-06)",
        "borderRadius": "var(--ww-border-radius-03)",
        "minHeight": "100vh"
      }
    }
  },
  "content": {
    "default": {
      "_ww-layout_flexDirection": "row",
      "_ww-layout_alignItems": "center"
    }
  }
}
```

When editing via the CLI:

```bash
weweb elements edit <uid> --page-id=<p> \
  --path=_state.style.default.backgroundColor \
  --value="var(--ww-color-bg-brand)"
```

**Never `--path=style.default.*`** (no leading `_state.`) — that creates a `style` field that has no DB column and gets dropped on write. **Never `--path=content.default.padding`** for standard CSS — the renderer ignores unprefixed non-layout keys under `content`.

## Children & slots

Most elements use a `children` array inside `content.default`:

```json
"content": {
  "default": {
    "_ww-layout_flexDirection": "column",
    "children": [
      { "isWwObject": true, "uid": "<childUid>" }
    ]
  }
}
```

**`ww-section` is the exception**: when a section is the parent (parent type = page), use `wwObjects` instead of `children`. The API auto-renames `children → wwObjects` on add for sections, but other endpoints expect `wwObjects` directly.

Elements with **named slots** (e.g. `ww-paginator` has `paginatorText`, `paginatorPrev`, `paginatorNext`) use the slot name as the key under `content.default`:

```json
"content": {
  "default": {
    "_ww-paginator_useCustomPagination": false,
    "_ww-paginator_paginatedSourceId": "tableView:abc-def",
    "paginatorText": [{ "isWwObject": true, "uid": "..." }],
    "paginatorPrev": [{ "isWwObject": true, "uid": "..." }],
    "paginatorNext": [{ "isWwObject": true, "uid": "..." }]
  }
}
```

To know which slots an element has: `weweb elements describe <tag>` — the `slots` array lists them.

## Breakpoints and states

`content.<key>` where key is one of:
- **Breakpoints**: `default`, `tablet`, `mobile` (inheritance: mobile → tablet → default)
- **States**: e.g. `hover`, `focus`, or any custom-state name defined on the element
- **State+breakpoint**: `<state>_<breakpoint>` — e.g. `hover_tablet`. Inherits down through the state's breakpoints, then to base breakpoints.

You don't need to populate every key — set only what differs from the inherited value.

## Worked example — add a heading under a section

```bash
weweb elements add \
  --page-id=$PAGE \
  --parent-id=$SECTION \
  --slot=wwObjects \
  --data '[
    {
      "tag": "ww-text",
      "name": "Hero headline",
      "content": {
        "default": {
          "tag": "h1",
          "_ww-text_text": { "en": "Build apps without writing code" },
          "_ww-text_fontSize": "var(--ww-text-display-lg-font-size)",
          "_ww-text_fontWeight": "700",
          "_ww-text_color": "var(--ww-color-content-primary)",
          "_ww-text_textAlign": "center"
        },
        "mobile": {
          "_ww-text_fontSize": "var(--ww-text-display-md-font-size)"
        }
      }
    }
  ]'
```

Then `weweb pages get $PAGE | grep -A2 "Hero headline"` to verify it landed.

## Pitfalls

- **Don't send unprefixed property names** for properties listed in the table above — the API silently ignores them.
- **Don't put the element-specific prefix on layout properties** — it's `_ww-layout_flexDirection`, NOT `_ww-section_flexDirection`.
- **Sections use `wwObjects` slot, not `children`** when nested under a page. Pass `--slot=wwObjects` for `weweb elements add` when parent is a section.
- **`uid` is optional but useful.** The CLI auto-fills missing `uid` fields with fresh UUIDs at add time. Pre-generate (or read from the response) if you need to reference an element you just created. For cross-references inside the same payload, use `❖fake-id❖` placeholders — the server replaces them with real UUIDs and resolves the references.
- **CSS values should reference design system tokens** (`var(--ww-color-bg-brand)`, `var(--ww-spacing-06)`) — see the `weweb-design-system` skill.
- **`tag` appears twice**: once at the element root (`tag: "ww-text"`) and once inside `content.default.tag` (`"h1"` / `"p"` / etc.) for ww-text to pick the HTML element. They are unrelated — the outer tag is the WeWeb type, the inner is the HTML output tag.
