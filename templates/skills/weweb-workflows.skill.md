---
name: weweb-workflows
description: Frontend workflows (element/page/app/global functions) and backend workflows. Load whenever wiring "on click do X", page-load fetches, button submissions, or backend API endpoints.
metadata:
  type: weweb
---

# Workflows

WeWeb has two flavors of workflow:

1. **Frontend workflows** — run in the browser. Triggered by user interactions or page lifecycle.
2. **Backend workflows** — run on the server. Exposed as API endpoints. Triggered by frontend `execute-backend-workflow` actions or directly via HTTP.

## Frontend workflows — four scopes

| Scope | Where it lives | Trigger types |
|---|---|---|
| `element` (also called `logic`) | On a specific element's `logic` field | Element events: `click`, `hover`, `change`, `submit`, `keydown`, … |
| `page` | On a page | Page lifecycle: `load`, `unload`, `scroll`, `resize`, `keydown`, `keyup` |
| `app` | On the project, all pages | App lifecycle: same as page-level |
| `function` (global) | On the project, callable from anywhere | Programmatic call only |

**Critical rule**: never declare a page/app workflow with an element-event trigger (`click`, `hover`, `change`). Those go on the element's `logic`. Page/app workflows only accept lifecycle triggers.

## Discover

```bash
weweb workflows list --type=any --json                            # all frontend workflows
weweb workflows list --type=page --page-id=<id> --json            # page-level only
weweb workflows list --type=function --search=fetch --json        # global functions

weweb backend-workflows list --json                               # backend workflows
weweb backend-workflows get <id> --json                           # full action tree
```

## Create a frontend workflow

```bash
weweb workflows create --page-id=<p> --json '{
  "scope": "page",
  "trigger": "load",
  "name": "Initial fetch",
  "actions": [
    { "type": "fetch-table-view", "tableViewId": "<viewId>" }
  ]
}'
```

For element-level (`logic`), workflows are part of the element subtree — set `logic: [{...}]` when adding/editing the element. Don't create a separate page workflow.

## Backend workflow

```bash
weweb backend-workflows create --json '{
  "name": "Create product",
  "trigger": { "type": "endpoint", "method": "POST", "path": "/products" },
  "parameters": [
    { "name": "title", "type": "string", "required": true },
    { "name": "price", "type": "number", "required": true }
  ],
  "actions": [
    { "type": "insert-row", "tableName": "products", "data": { ... } },
    { "type": "return", "value": { ... } }
  ]
}'
```

Backend workflows can also be triggered by table-row CRUD events or schedules.

## File parameters in backend workflow calls

When a backend workflow has a `file` type parameter, the frontend binding is **different**:

- File params: bind as plain string `"{elementUid}-value"` (where `elementUid` is the `ww-input-file` element's uid)
- Other params: bind as formula object `{"__wwtype":"f","code":"..."}`

See `weweb-storage` for the full pattern.

## What to do and not to do

- **Do** put element-event workflows on the element's `logic` field, not as page/app workflows
- **Do** use `function` scope for logic you'll call from multiple places
- **Do** name workflows descriptively — they show up in the editor's panel
- **Do not** mix `click` triggers into page/app scope — only lifecycle triggers
- **Do not** put async fetches in element-event workflows that block UI — use page-load instead and bind data to `globalContext`
