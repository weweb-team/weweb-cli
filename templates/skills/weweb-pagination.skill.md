---
name: weweb-pagination
description: Pagination over table views, collections, and arrays using `ww-paginator`. Load whenever a list of items needs page-by-page navigation.
metadata:
  type: weweb
---

# Pagination skill

## Always use `ww-paginator`

Any time a user asks for pagination UI on a table view or collection, use the `ww-paginator` element. **Never build a custom pagination system** with variables, buttons, offset logic, or manual `fetch-table-view` calls.

## Table view pagination (most common case)

Set `useCustomPagination` to `false` and `paginatedSourceId` to `"tableView:<TABLE_VIEW_UUID>"`.

The paginator is **fully self-contained**:
- It reads `globalContext.tableViews['<UUID>'].metadata` (total, limit, offset) automatically.
- On page change, it refetches the table view with the new offset by itself — **no workflow on the change event is needed**.
- The items-per-page (limit) is configured in the table view's backend settings — it is **not a runtime parameter** to pass in `fetch-table-view`.

The data list (repeated element) must be bound to `globalContext.tableViews['<UUID>']?.data`.

**Do not** create offset or limit variables. **Do not** add a workflow on the paginator's change event. **Do not** add `limit` or `offset` parameters to `fetch-table-view` actions just for pagination.

## Collection pagination

Set `useCustomPagination` to `false` and `paginatedSourceId` to `"collection:<COLLECTION_ID>"`. Same self-contained behavior as table view pagination.

## Custom pagination mode

Use `useCustomPagination: true` **only** for arrays or manual pagination states that are not backed by a table view or collection. In this mode you must provide `paginatorTotal`, `paginatorLimit`, and `paginatorOffset`, and update `paginatorOffset` from the change event's `event.context.offset` value using a variable and a workflow.

## Slots

The paginator requires 3 child elements in its slots:
- `paginatorText` slot: a `ww-text` element (repeated automatically for each page number / ellipsis — **do not set its text content**). Add an `active` state to style the current page.
- `paginatorPrev` slot: a `ww-icon` element for the previous-page control.
- `paginatorNext` slot: a `ww-icon` element for the next-page control.

## Datagrid pagination (exception)

`ww-datagrid-ag` handles pagination entirely on the **frontend** — it needs all rows loaded at once.

- **Do not** use `ww-paginator` with a datagrid.
- **Do not** set a `limit` on the table view bound to a datagrid.
- Use the datagrid's built-in `pagination` and `paginationPageSize` properties instead.

## What to do and not to do

- **Do not** build buttons, text, and a workflow to manually handle pagination — use `ww-paginator` instead.
- **Do not** create offset or limit variables for table view / collection pagination.
- **Do not** add a workflow on the paginator's change event when using table view or collection pagination.
- **Do not** pass `limit` or `offset` as parameters in `fetch-table-view` actions just for pagination — the paginator manages this natively.
- **Do** bind the repeated list data to `globalContext.tableViews['<UUID>']?.data`.
- **Do** configure the items-per-page limit in the table view's backend settings, not in the frontend.
