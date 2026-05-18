---
name: weweb-pages
description: Page and element model — how to inspect a page, add/edit/delete/move elements, and understand element types. Load before any page-layout work. For element-content shape and prefixed property keys, also load `weweb-element-types`.
metadata:
  type: weweb
---

# Pages and elements

A page is a tree of elements. The root is implicit; under it are one or more `ww-section`s, each of which contains other elements. Children live in named **slots** — most commonly `children`, with one important exception: when the parent is a `ww-section` the slot is `wwObjects`. Specialized elements have other slot names (e.g. `ww-paginator` has `paginatorText`, `paginatorPrev`, `paginatorNext`).

> **Before editing element content**, also load the `weweb-element-types` skill — it covers the prefix rules (`_ww-<tag>_<prop>`) and the friendly→prefixed property name table. This skill assumes you know that shape.

## Discover

```bash
weweb pages list --json                                    # all pages
weweb pages get <pageId>                                   # markdown semantic — fastest scan
weweb pages get <pageId> --json                            # JSON form
weweb elements list --page-id=<pageId> --json              # elements under sections (NOT sections themselves)
weweb elements list --page-id=<pageId> --uids=<sectionUid> # explicitly fetch a section by uid
weweb elements describe ww-text --json                     # bundled schema for any element type
```

`weweb pages get` returns a **markdown semantic representation** — the same format the WeWeb in-editor AI uses. It includes the design system, every element with its style/content/bindings, all workflows, all variables. Always read this first.

### Sections aren't in `elements list` by default

The underlying `/page-elements` endpoint returns wwObjects (children of sections) — NOT sections themselves. To see a section, pass its uid explicitly via `--uids=<sectionUid>`. You'll find section uids in `weweb pages get` (markdown) or by parsing the full page semantic JSON.

## Find an element by name/text

Don't guess UIDs. Read the page semantic (`weweb pages get`) and look for `name:` or the text content. Element UIDs are 36-char UUIDs (e.g. `a1b2c3d4-e5f6-7890-...`).

## Add an element

```bash
weweb elements add \
  --page-id=<p> \
  --parent-id=<u> \
  --slot=children \
  --data '[
    {
      "tag": "ww-text",
      "name": "Headline",
      "content": {
        "default": {
          "tag": "h1",
          "_ww-text_text": { "en": "Welcome" },
          "_ww-text_fontSize": "var(--ww-text-display-md-font-size)",
          "_ww-text_color": "var(--ww-color-content-primary)"
        }
      }
    }
  ]'
```

Rules:
- `--data` is **always an array** of element subtrees, even for a single element.
- **The server creates only the top-level elements in `--data`. Nested `children` / `wwObjects` arrays inside an element's `content.default` are NOT recursed.** To build a multi-level tree, add the parents first, then add each level of children in a separate `weweb elements add` call using the freshly-created parent uid.
- Property keys inside `content.<state>` are **prefixed for typography (`_ww-text_*`) and flex/grid layout (`_ww-layout_*`, `_ww-grid_*`)**. **Raw CSS** (`backgroundColor`, `backgroundGradient`, `padding`, `margin`, `borderRadius`, `boxShadow`, `width`, `minHeight`, `display`, `cursor`, …) does **NOT** live on `content` — it lives on **`_state.style.<state>.<cssProp>`** (the `_state` JSONB column). See `weweb-element-types` for the full table.
- Prefer `var(--ww-…)` tokens for color/spacing/font over hardcoded values — see `weweb-design-system`.
- `uid` is **optional**: the CLI auto-fills missing `uid` fields with fresh UUIDs at add time. If you need a known uid (e.g. to reference it in subsequent commands without parsing the response), pre-generate one. If you have nested cross-references in the same payload, use `❖my-fake-id❖` placeholders — the server replaces them with real UUIDs and resolves the references.
- **Slot for section parents is `wwObjects`, not `children`** — pass `--slot=wwObjects` when `--parent-id` is a section uid.
- **To add a new top-level `ww-section` to a page**, set `--parent-id=<pageId>` and `--slot=wwObjects`. The back's `getAddElementsActions` detects `parentType === 'page' && tag === 'ww-section'` and creates a real section record.

## Edit one property of an element

```bash
weweb elements edit <uid> --page-id=<p> \
  --path=content.default._ww-text_color \
  --value="var(--ww-color-content-brand)"
```

The path is dot-notation into the element JSON. **Always start the path with `content.<state>.`** — typically `content.default.`. To edit multiple properties, run the command multiple times.

`--value` accepts strings, numbers (`24`), booleans (`true`), `null`, or JSON literals (`'{"en":"Hello"}'`).

> ⚠️ **Never use `--path=style.default.*`.** Element styling does not live under a `style` field — there is no such column on the server. The CLI accepts the path and reports success, but Sequelize silently drops it on write and the value is lost. **All persistent state goes under `content.<state>.*`** (see `weweb-element-types` for the prefix rules).

## Delete

```bash
weweb elements delete <uid> --page-id=<p> --parent-id=<parentUid>
```

`--parent-id` helps the API rebuild the parent's children/wwObjects array.

## Move

```bash
weweb elements move <uid> \
  --page-id=<p> \
  --old-parent-id=<currentParent> \
  --new-parent-id=<targetParent> \
  --slot=children \
  --previous-id=<elementToInsertAfter>
```

## Replace

```bash
weweb elements replace <uid> --page-id=<p> --data '[
  { "tag": "ww-text", "content": { "default": { "_ww-text_text": { "en": "New text" } } } }
]'
```

Same shape as `add`. The element identified by `<uid>` is swapped with the elements in `--data` (typically a one-element array).

## Common element tags

| Tag | Purpose |
|---|---|
| `ww-section` | Top-level rows on a page. Don't nest sections inside sections — use `ww-div`. |
| `ww-div` | Generic flex/grid container inside a section. |
| `ww-text` | Text content. Headings and paragraphs both use this — `content.default.tag` (h1–h4, p, div, button) determines the HTML tag. |
| `ww-button` | Buttons. `type: 'submit'` inside a `ww-form-container` triggers the form submit. |
| `ww-image` | Images. Bind `_ww-image_src`. |
| `ww-icon` | SVG icons from active icon sets (`weweb icons project`). |
| `ww-input-*` | Form inputs. See `weweb-forms`. |
| `ww-paginator` | Pagination over table views/collections. See `weweb-pagination`. |

For the full property set on any tag: `weweb elements describe <tag>` (reads bundled schema from weweb-ai). For real-world examples in this project: `weweb elements list --page-id=<p> --uids=<existingUid>`.

## Verify after every mutate

```bash
weweb pages get <pageId>
```

If your change isn't visible, you likely picked the wrong parent uid or slot. Re-read and check the parent's children/wwObjects array.

## Pitfalls

- **`style.default.*` paths fail silently.** The CLI accepts them and prints `✓ Element edited`, but the server has no top-level `style` column — Sequelize drops the value. The correct path for raw CSS is `_state.style.<state>.<cssProp>`.
- **Two homes for styling, decided by property group.** Typography goes on `content.<state>._ww-text_*` (e.g. `_ww-text_fontSize`). Flex/grid layout goes on `content.<state>._ww-layout_*` / `_ww-grid_*`. **Everything else — raw CSS** (`backgroundColor`, `backgroundGradient`, `padding`, `margin`, `borderRadius`, `boxShadow`, `width`, `minHeight`, `display`, `cursor`, …) — goes on **`_state.style.<state>.<cssProp>`**. There is no `_ww-section_*` prefix — that group does not exist. See `weweb-element-types`.
- **`elements add` does not recurse nested children.** Only the top level of each `--data` entry is created. Add parents first, then add their children in separate calls referencing the new parent uid.
- **The `tag` field, not `type`.** Using `"type": "ww-…"` in `--data` is silently coerced to `ww-div`. Always use `"tag"`.
- **Section parents use `wwObjects` slot, not `children`.** Pass `--slot=wwObjects` for `add` and `move` when targeting a section as parent. To add a brand-new top-level section, set `--parent-id=<pageId>` and `--slot=wwObjects`.
- **A `ww-div` only accepts children if its `content.default.children` array exists.** A bare-newly-created `ww-div` may fail the next `elements add` with "does not have a valid slot children". Initialize `content.default.children: []` (and the layout props you want) when you create the div, then add children referencing it.
- **No element-event workflows on app/page scope.** "On click do X" goes on the element's `logic` field — not as a separate page/app workflow.
- **Re-use sections via `reuseSectionId`.** To share a section across pages, set the same `reuseSectionId` semantic prop on a `ww-section` on each page. The platform links them automatically — no CLI command needed.
- **Sections shouldn't have width/height on the root.** They adapt to the page. Set inner element sizing instead.
- **`elements list` returns wwObjects only.** Sections need `--uids=<sectionUid>` to fetch explicitly, or read `weweb pages get` for the full tree.
- **`uid` field is 36 chars (UUID), not 8.** The "8 hex chars" you may have seen elsewhere is the short form used in some legacy logs; the API always uses full UUIDs.
