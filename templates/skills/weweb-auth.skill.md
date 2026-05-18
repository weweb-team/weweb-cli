---
name: weweb-auth
description: Auth providers, roles, and users. Load whenever building sign-in/sign-up flows, gating routes, managing users, or assigning roles.
metadata:
  type: weweb
---

# Auth

WeWeb supports multiple auth providers (its own `weweb-auth`, plus third-party). The active provider is stored as an env variable; some operations (`list_roles`, `list_users`, `create_user`) only work when `weweb-auth` is the installed provider.

## Discover

```bash
weweb auth-providers installed --json                       # currently installed provider(s)
weweb auth-providers roles-list --json                      # roles (weweb-auth only)
weweb auth-providers users-list --json --limit=50           # users (weweb-auth only)
```

## Install / update a provider

```bash
weweb auth-providers install <providerName> \
  --editor='<editor-value>' --staging='<staging-value>' --production='<prod-value>'
```

Provider config is stored as `PROVIDER_<name>` env variables. You'll need to know the provider-specific keys/secrets to fill in editor/staging/production values.

```bash
weweb auth-providers delete <providerName>                  # uninstall
```

## Roles (weweb-auth)

```bash
weweb auth-providers roles-create <roleName>
weweb auth-providers roles-delete <roleName>
```

Roles are used in workflow conditions (gate a backend endpoint to `admin` role) and in page route guards.

## Users (weweb-auth)

```bash
weweb auth-providers users-list --search=alice --limit=20 --json
weweb auth-providers users-create --email=alice@example.com --password='…' --name='Alice'
```

To list/manage users on third-party providers, use the provider's own admin UI — those operations aren't exposed through this CLI.

## Wiring up a sign-in page

The pattern: a `ww-form-container` with `ww-input-basic` (email), `ww-input-basic` (password, `type: password`), and a submit `ww-button`. The form's submit workflow calls the provider's `sign-in` workflow action. Bind the form inputs to plain values (no need for variables — use `{elementUid}-value`).

See `weweb-forms` for form layout details.

## What to do and not to do

- **Do** check `auth-providers installed` before assuming users/roles operations work
- **Do** use roles to gate backend workflows, not ad-hoc checks
- **Do** store provider secrets via the `--staging`/`--production` flags so dev and prod can have different keys
- **Do not** put auth keys in editor-scope env values that get exposed to the frontend
- **Do not** create roles inline in workflow conditions — define them centrally with `roles-create`
