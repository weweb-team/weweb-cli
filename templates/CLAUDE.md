# WeWeb project

This directory is bound to a WeWeb project. Use the `weweb` CLI to inspect and edit the project. **All edits are server-side** — there are no local source files to read for the project itself; the source of truth lives in WeWeb's backend and is fetched/mutated via API.

## The five things to know before doing anything

1. **A WeWeb project** has pages, a design system (tokens, classes), backend tables, frontend variables, frontend workflows, backend workflows, env variables, and integrations.
2. **Pages contain elements** organized as a tree. Each element has a `uid`, a `tag` (`ww-section`, `ww-text`, `ww-button`, …), `content` (text/props per breakpoint/state), optional element-level `workflows` (called `logic`), and children in named slots (`children` for most parents, `wwObjects` for sections).
3. **Element content keys are PREFIXED** — `content.default._ww-text_text`, not `content.text`. The prefix is `_ww-<tag>_<prop>` for element-specific props, `_ww-layout_<prop>` for flex layout, `_ww-grid_<prop>` for grid. See the `weweb-element-types` skill for the full table.
4. **Every reference is by full UUID** (36-char). Element uids, page ids, variable ids — all UUIDs. Always pass them verbatim from data — never guess or shorten.
5. **Read before writing.** Always inspect with `weweb pages get <id>` (semantic markdown) before mutating. Re-read after mutating to verify.

## Working pattern

```
1. weweb pages list --json                                → find the page id
2. weweb pages get <pageId>                               → understand the current state
3. weweb design-system get --json                         → know which tokens/classes to use
4. weweb elements describe <tag>                          → learn an element type's properties (bundled docs)
5. (mutate via the appropriate command — see skills)
6. weweb pages get <pageId>                               → verify
```

## Output is JSON-parseable

Every command supports the root `--json` flag for structured output. Chain commands by parsing the JSON. The non-`--json` output is for humans only and is NOT stable.

> **Payloads go through `--data`, not `--json`.** Commands that take a JSON payload (`pages create`, `elements add`, `elements replace`, `tables alter`, etc.) accept it via `--data '<json>'`. The root `--json` flag is reserved for selecting JSON OUTPUT mode.

## Skills

Skills under `.claude/skills/` describe specific patterns. Load them on demand:

- `weweb-overview` — start here
- `weweb-pages` — page + element model: list/add/edit/delete/move/replace
- `weweb-element-types` — element-content prefix rules, friendly→prefixed property mapping table, worked examples
- `weweb-design-system` — tokens, classes, when to bind vs hardcode
- `weweb-tables` — backend tables, rows, views, integration tables
- `weweb-workflows` — frontend and backend workflows, triggers
- `weweb-auth` — auth providers, roles, users
- `weweb-integrations` — third-party integrations, connections
- `weweb-forms` — form layouts and input handling
- `weweb-pagination` — when and how to use `ww-paginator`
- `weweb-sidebars` — sidebar layouts
- `weweb-storage` — file uploads, storage columns, public URLs

## Common pitfalls

- **Element-event triggers ≠ page/app workflows.** Page or app-level workflows have triggers like `load`, `unload`, `scroll`, `resize`, `keydown`, `keyup`. Never declare a page/app workflow whose trigger is `click`/`hover`/`change` — those go on the element's `logic` field instead.
- **Linked sections aren't a tool.** To share a section across pages, set the same `reuseSectionId` semantic prop on a `ww-section` on each page; the system links them automatically.
- **Optional chaining everywhere.** When binding, always use `?.` and `??` for fallbacks. Project data can be partial.
- **No element width/height on roots.** Sections fluidly adapt. Inner divs can be sized.

## Authentication

The CLI uses the public API key + workspace ID from `~/.weweb/config.json` (run `weweb auth login` once). The project-local `.weweb/config.json` only stores the project ID this directory is bound to.
