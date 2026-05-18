---
name: weweb-tables
description: Backend tables, columns, rows, table views. Use whenever the user wants to store data, list records, or do CRUD on backend tables.
metadata:
  type: weweb
---

# Backend tables

WeWeb's backend tables are real Postgres tables. You can create/alter them, insert/update/delete rows, and define **table views** (saved queries) that the frontend reads via `globalContext.tableViews['<UUID>']`.

## Discover

```bash
weweb tables list --json                                # all tables + columns
weweb tables rows <tableName> --json --limit=20         # peek at data
weweb tables views-list --table-name=<name> --json      # views for a table
```

## Schema operations (alter)

```bash
# Create a table
weweb tables alter --json '{
  "action": "createTable",
  "tableName": "products",
  "description": "Product catalog",
  "columns": [
    { "name": "id", "type": "uuid", "primary": true },
    { "name": "title", "type": "text", "nullable": false },
    { "name": "price", "type": "numeric" }
  ]
}'

# Add a column
weweb tables alter --json '{ "action": "addColumn", "tableName": "products", "column": { "name": "stock", "type": "integer", "default": 0 } }'

# Other actions: dropTable, dropColumn, renameColumn, renameTable,
#                modifyColumnType, addConstraint, dropConstraint
```

The `id` column is added automatically if you don't include it.

## Row operations

```bash
weweb tables row-add    <tableName>     --json '{ "title": "Hat", "price": 19.99 }'
weweb tables row-update <tableName> <id> --json '{ "price": 24.99 }'
weweb tables row-delete <tableName> <id>
```

## Filters and sorting

`weweb tables rows` accepts `--filters` and `--sort`:

```bash
weweb tables rows products \
  --filters '{"conditions":[{"column":"price","operator":">","value":10}],"link":"$and"}' \
  --sort '[{"column":"price","direction":"desc"}]' \
  --limit 50
```

## Table views

Table views are how the frontend reads data — never bind a frontend repeating list to a raw table. Create a view, then bind to `globalContext.tableViews['<viewId>']?.data`.

```bash
weweb tables views-list --json                          # all views in project
weweb tables view-data <viewId> --json                  # fetch the view's rows
```

To create/edit table views, use the `save` action (managed via the `weweb-workflows` skill — table views go through the same save endpoint).

## Pagination

Set the items-per-page limit in the **table view's backend settings**, not in `fetch-table-view` runtime parameters. Use a `ww-paginator` on the frontend bound to the view ID — see `weweb-pagination`.

## What to do and not to do

- **Do** read `tables list` before creating a table — the schema may already exist
- **Do** create a table view for every list the frontend will show
- **Do** use `?.data` and optional chaining when binding to table views (data is null while loading)
- **Do not** bind a frontend list directly to raw table rows — use a view
- **Do not** pass `limit`/`offset` to `fetch-table-view` for pagination — that's the paginator's job
- **Do not** hardcode UUID ids in row inserts — let Postgres assign them
