---
name: weweb-overview
description: Always-load overview of how to inspect and edit a WeWeb project via the `weweb` CLI. Start here before any other weweb-* skill.
metadata:
  type: weweb
---

# WeWeb project overview

You are editing a WeWeb project through the `weweb` CLI. The project's source of truth lives in WeWeb's backend; there are no local source files to grep for the project content itself. Every read and every mutation is an HTTP call routed through `npx weweb …`.

## Always do this first

```bash
weweb pages list --json                  # discover the page IDs
```

Pick the page you need by name. Then:

```bash
weweb pages get <pageId>                 # markdown semantic of the page (elements, vars, workflows)
weweb design-system get --json           # tokens, classes, guidelines available
```

## Mutation rule

Read → plan → mutate → re-read.

- Read the page semantic.
- State your plan in plain English (what element you'll add/edit and why).
- Make the change with one CLI call.
- Re-read the page to verify the change applied as you expected.

Never mutate without reading first. Element UIDs in your prompt history might be stale.

## Element model (short version)

A page is a tree of elements. Each element has `uid` (UUID), `tag` (`ww-section`, `ww-text`, …), `name`, and `content` keyed by breakpoint/state (`default`, `tablet`, `mobile`, `hover`, …). Inside each state, property keys are **prefixed**: `_ww-<tag>_<prop>` for element-specific properties, `_ww-layout_<prop>` for flex layout, `_ww-grid_<prop>` for grid.

```json
{
  "uid": "<uuid>",
  "tag": "ww-text",
  "name": "Headline",
  "content": {
    "default": {
      "tag": "h1",
      "_ww-text_text": { "en": "Welcome" },
      "_ww-text_fontSize": "var(--ww-text-display-md-font-size)"
    }
  }
}
```

To add an element: `weweb elements add --page-id=<p> --parent-id=<u> --data '[{...}]'`. The `--data` array describes one or more element subtrees to insert under `parent-id`. Use `--slot=wwObjects` when the parent is a `ww-section`.

To edit one property: `weweb elements edit <uid> --page-id=<p> --path=content.default._ww-text_color --value=#fff`.

To delete: `weweb elements delete <uid> --page-id=<p> --parent-id=<parentUid>`.

**Load the `weweb-element-types` skill** before constructing element JSON — it has the full prefix rule and the friendly→prefixed name table (e.g. `flexDirection` → `_ww-layout_flexDirection`).

To learn an element type: `weweb elements describe <tag>` prints its bundled documentation JSON.

## What you'll need handy

- **Page ID** — from `pages list`
- **Element UIDs (UUIDs)** — from `pages get` or `elements list --page-id=<p>` (note: `elements list` returns wwObjects under sections, not sections themselves; pass `--uids=<sectionUid>` to fetch a section)
- **Token names** — from `design-system get` (e.g. `var(--ww-color-bg-brand)`)
- **Class names** — from `design-system get`
- **Table names** — from `tables list`
- **Variable IDs** — from `variables list`
- **Element-type schema** — from `elements describe <tag>` (bundled docs)

## Choose the right skill

| Doing | Load |
|---|---|
| Designing or redesigning a full page (multiple sections) | `weweb-page-design` + `weweb-pages` + `weweb-element-types` |
| Building a page layout | `weweb-pages` + `weweb-element-types` |
| Constructing element JSON | `weweb-element-types` |
| Picking colors/spacing | `weweb-design-system` |
| Working with rows/columns | `weweb-tables` |
| Wiring buttons / page loads | `weweb-workflows` |
| Auth / users / roles | `weweb-auth` |
| Connecting Airtable/Stripe/… | `weweb-integrations` |
| Forms with inputs | `weweb-forms` |
| Lists with pagination | `weweb-pagination` |
| Fixed sidebars | `weweb-sidebars` |
| File uploads / images | `weweb-storage` |

## Discovery

If you don't know which CLI command does something, run `weweb --help` then `weweb <group> --help`. Each command also supports `--help` and `--json`.
