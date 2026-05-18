---
name: weweb-integrations
description: Third-party integrations — Airtable, Stripe, Supabase, etc. Integration tables, connections, project integrations. Load whenever the user wants to connect to or query an external service.
metadata:
  type: weweb
---

# Integrations

WeWeb integrations connect a project to a third-party service. Each integration has:

- A **connection** — credentials (API key, OAuth token) stored in env variables
- A **project integration** — the fact that this integration is enabled on this project
- Optional **integration tables** — table-view-like surfaces over external data (e.g. an Airtable base presented as a table view inside WeWeb)

## Discover

```bash
weweb integrations projects --json                       # which integrations are installed on this project
weweb integrations connections --json                    # configured connections (credentials)
weweb integrations tables-list --json                    # integration tables (Airtable bases, Supabase tables, …)
weweb integrations auth-provider --json                  # which integration provides auth
weweb integrations storage-provider --json               # which integration provides storage
```

## Create an integration table

This wires an external data source as a WeWeb table view. Useful for "show the Stripe customers in a list":

```bash
weweb integrations tables-create \
  --name="Airtable Customers" \
  --integration="airtable" \
  --connection-id=<connId> \
  --config='{"baseId":"app123","tableId":"tbl456","fields":["Name","Email"]}' \
  --description="Customers from main Airtable base" \
  --type="back"
```

The `config` shape is integration-specific. Look at existing integration tables (`integrations tables-list`) for examples in the same project.

## Rename / delete

```bash
weweb integrations tables-rename <id> --name="New name"
weweb integrations tables-delete <id>
```

## Auth and storage as integrations

`integrations auth-provider` and `integrations storage-provider` report which integration owns those concerns for the project. Most often `weweb-auth` and `weweb-storage` — but third-party providers (Supabase Auth, S3) can take over.

## What to do and not to do

- **Do** list existing integration tables first — chances are the connection already exists
- **Do** check `integrations storage-provider` before assuming `weweb-storage` for file URLs
- **Do** reuse connections by `connection-id` rather than configuring credentials twice
- **Do not** put OAuth tokens in editor-scope env values
- **Do not** hardcode integration-specific config keys — check `tables-list` for the shape your project actually uses
