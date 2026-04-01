# WeWeb CLI (weweb-cli)

## Project Identity

- **What**: Node.js CLI tool — builds, serves, and pushes WeWeb components (sections, elements, plugins)
- **Stack**: Commander.js, Webpack 5, Vue 3 (vue-loader), Babel, SCSS, ShellJS
- **Runtime**: Node.js >= 22, **CommonJS** (`require`/`module.exports`)
- **Bin entry**: `weweb` → `bin/weweb.js`
- **npm package**: `@weweb/cli` (installed as a dev dependency in component projects)

## This Project IS / IS NOT

- **IS**: The CLI that component developers use to serve, build, and push WeWeb components
- **IS**: A webpack-based build tool that generates `dist/manager.js` bundles
- **IS**: The dev server that hot-reloads components into the WeWeb editor via `window.addWwComponent`
- **IS**: A push tool that uploads coded components to WeWeb workspaces via the public API
- **IS**: Designed for both humans (interactive) and AI agents (headless `--json` mode)
- **IS NOT**: The WeWeb editor itself (that's `weweb-editor` on port 4040)
- **IS NOT**: The backend API (that's `weweb-back` on port 3000)
- **IS NOT**: An ES module project — uses CommonJS throughout

## Formatting Rules

No `.prettierrc` or `.eslintrc` exists. Observed style:

```
Double quotes             ← "string" for new code
4-space indentation       ← No tabs
Semicolons                ← Always present
CommonJS                  ← require() / module.exports / exports.name
Arrow parens: present     ← (argv) => {}
```

## Directory Structure

```
weweb-cli/
├── bin/
│   ├── weweb.js                    # CLI entry point (Commander.js program)
│   ├── commands/
│   │   ├── auth.js                 # auth login/logout/status
│   │   ├── serve.js                # serve command (prebuild + webpack-dev-server)
│   │   ├── build.js                # build command (prebuild + webpack production)
│   │   └── push.js                 # push component to WeWeb workspace
│   ├── core/
│   │   └── prebuild.js             # Generates temporary index.js for webpack entry
│   └── utils/
│       ├── output.js               # Human/JSON dual output, TTY detection
│       ├── config.js               # Config file management (~/.weweb/)
│       ├── errors.js               # Structured errors, exit codes
│       ├── api.js                  # Authenticated API client (fetch + Bearer token)
│       └── files.js                # File collection for push
├── assets/
│   ├── index.html                  # Dev server status page
│   ├── index.js                    # Generated at runtime by prebuild (gitignored)
│   └── info.json                   # Generated at runtime by webpack (gitignored)
├── webpack.dev.config.js           # Development server webpack config
└── package.json                    # @weweb/cli
```

## Architecture

### Command Flow

```
CLI entry (weweb.js / Commander) → Command handler (commands/*.js) → Utils / Core
```

### Build Pipeline (serve/build)

```
Command → Prebuild (generate index.js) → Webpack (bundle)
```

### Push Pipeline

```
Command → Collect files → Validate → API POST → Build on server → Result
```

## CLI Commands

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as structured JSON (machine-readable) |
| `--no-color` | Disable ANSI colors |
| `--verbose` | Verbose output |
| `-V, --version` | Show version |

### `weweb auth login`

```bash
# Interactive (prompts for missing values)
weweb auth login

# Non-interactive (flags or env vars)
weweb auth login --api-key=ww-private-xxx --workspace-id=xxx
WEWEB_API_KEY=ww-private-xxx WEWEB_WORKSPACE_ID=xxx weweb auth login
```

Validates credentials against the public API, then saves to `~/.weweb/config.json` (mode 0600).

### `weweb auth status`

```bash
weweb auth status           # Human-readable
weweb --json auth status    # JSON output
```

### `weweb auth logout`

Clears stored credentials from `~/.weweb/config.json`.

### `weweb serve`

```bash
weweb serve                 # Default port 8080
weweb serve -p 9090         # Custom port
weweb serve port=8080       # Legacy format (backwards compatible)
```

Starts webpack-dev-server with HTTPS, HMR, CORS headers.

### `weweb build`

```bash
weweb build -n MyComponent -t section
weweb build --name MyComponent --type wwobject
weweb build name=Foo type=plugin  # Legacy format
```

Produces `dist/manager.js`. Type must be `section`, `wwobject`, or `plugin`.

### `weweb push`

```bash
weweb push -p <projectId>                          # Push new component
weweb push -p <projectId> -c <componentId>          # Update existing
weweb push -p <projectId> -m "Added hover state"    # Custom commit message
weweb push -p <projectId> --no-activate              # Don't auto-activate
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `-p, --project <id>` | Yes | `WEWEB_PROJECT_ID` env | Target project (design) ID |
| `-c, --component <id>` | No | creates new | Existing component ID to update |
| `-m, --message <msg>` | No | "Pushed via CLI" | Commit message |
| `--no-activate` | No | activates | Don't auto-activate the new version |

**Flow:**
1. Load auth config (API key + workspace ID)
2. Collect files: `package.json` + `ww-config.js(on)` + all `src/` files
3. POST to `/public/v1/workspaces/:id/projects/:id/source_codes/wwobjects/build`
4. Server uploads to S3, invokes Lambda builder, activates version
5. Display result (or JSON with `--json`)

### `weweb pull`

```bash
weweb pull -p <projectId>                                    # List components
weweb pull -p <projectId> -c <componentId>                   # Pull active version to CWD
weweb pull -p <projectId> -c <componentId> --version-id <id>    # Pull specific version
weweb pull -p <projectId> -c <componentId> -o ./my-comp      # Pull to specific dir
weweb pull -p <projectId> -c <componentId> --force           # Overwrite existing files
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `-p, --project <id>` | Yes | `WEWEB_PROJECT_ID` env | Target project (design) ID |
| `-c, --component <id>` | No | lists components | Component ID to pull |
| `--version-id <id>` | No | active version | Specific version ID |
| `-o, --output <dir>` | No | `.` | Output directory |
| `--force` | No | false | Overwrite existing files |

**Flow:**
1. Load auth config (API key + workspace ID)
2. If no `--component`: list all components in the project and exit
3. GET component list to resolve version ID (active or `--version`)
4. GET `/public/v1/workspaces/:id/projects/:id/source_codes/wwobjects/:id/versions/:id/files`
5. Write files to disk (with overwrite protection unless `--force`)

## Configuration

### User-level config: `~/.weweb/config.json`

```json
{
    "apiKey": "ww-private-xxx",
    "apiUrl": "https://api.weweb.io/v1",
    "workspaceId": "uuid"
}
```

### Precedence

```
CLI flags (highest) > Environment variables > Config file > Defaults (lowest)
```

### Environment Variables

| Variable | Maps to |
|----------|---------|
| `WEWEB_API_KEY` | API key |
| `WEWEB_API_URL` | API URL |
| `WEWEB_WORKSPACE_ID` | Workspace ID |
| `WEWEB_PROJECT_ID` | Project ID (for push) |

## Output Modes

### Human mode (default)

```
✓ Component pushed successfully
  name: my-component
  id: xxx-xxx
  version: 3
```

### JSON mode (`--json`)

```json
{
    "status": "ok",
    "name": "my-component",
    "id": "xxx-xxx",
    "version": 3
}
```

### Stream discipline

- **stdout**: Program results only (data to pipe/process)
- **stderr**: Progress, status messages, prompts, errors (in human mode)

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | User cancellation |
| 4 | Authentication error |
| 8 | Build/push failed |

## Code Patterns

### Entry Point — Commander Program

From `bin/weweb.js`:

```javascript
const { program } = require("commander");
const pkg = require("../package.json");
const output = require("./utils/output.js");

program
    .name("weweb")
    .description("WeWeb CLI — build, serve, and push components")
    .version(pkg.version)
    .option("--json", "Output as JSON (machine-readable)")
    .hook("preAction", (thisCommand) => {
        const opts = thisCommand.optsWithGlobals();
        if (opts.json) output.setJsonMode(true);
    });
```

### Command Pattern

From `bin/commands/push.js`:

```javascript
const config = require("../utils/config.js");
const api = require("../utils/api.js");
const files = require("../utils/files.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

async function push(options) {
    const cfg = config.loadConfig();
    if (!cfg.apiKey || !cfg.workspaceId) errors.authError();

    // ... collect files, validate, call API ...

    output.success("Component pushed successfully.", { name, id, version });
}

module.exports = { push };
```

### Output Utility Pattern

From `bin/utils/output.js`:

```javascript
// success() — prints to stdout (human or JSON)
output.success("Message", { key: "value" });

// error() — prints to stderr (human) or stdout (JSON)
output.error("Message", "ERROR_CODE", { details });

// info() — prints to stderr, suppressed in JSON mode
output.info("Progress message...");

// fatal() — prints error and exits with code
errors.fatal("Message", "CODE", exitCode);
```

### API Client Pattern

From `bin/utils/api.js`:

```javascript
const response = await api.post(
    `/public/v1/workspaces/${workspaceId}/projects/${projectId}/source_codes/wwobjects/build`,
    { files: fileMap, commit: "message", autoActive: true }
);
```

Uses `Authorization: Bearer {apiKey}` header. Throws on non-2xx with `.status`, `.code`, `.body`.

## Component Discovery

`files.js` resolves the component entry file in this order:

1. `package.json` → `weweb.componentPath` (explicit path)
2. `./src/wwElement.vue` (element component)
3. `./src/wwSection.vue` (section component)
4. `./src/wwPlugin.js` (plugin)

## Config File Resolution

The CLI looks for component configuration at the project root:

1. `ww-config.js` (preferred)
2. `ww-config.json` (fallback)

## Code Block Stripping

The `weweb-strip-block` webpack loader removes code between markers:

```javascript
/* wwFront:start */
// This code is stripped from manager builds
/* wwFront:end */
```

Applied to: `.js`, `.vue`, `.css`, `.scss` files

## Template Placeholders

Webpack's `string-replace-loader` replaces at build time:

| Placeholder | Replaced With | Source |
|-------------|---------------|--------|
| `__NAME__` | Component name | `--name` CLI argument |
| `__VERSION__` | Package version | `package.json` `version` field |
| `__COMPONENT_NAME__` | Component name | (empty string in current code) |

## Webpack: Dev vs Production

| Feature | Dev (`serve`) | Production (`build`) |
|---------|---------------|---------------------|
| Config | `webpack.dev.config.js` | Inline in `build.js` |
| Mode | `development` | `production` |
| Source maps | `inline-source-map` | None |
| Output | `assets/manager.js` (in memory) | `dist/manager.js` |
| Externals | `vue`, `react`, `react-dom` | `vue` only |
| HMR | Yes (HTTPS + WebSocket) | No |

## Ecosystem Connection

```
Component Project
├── src/wwElement.vue        ← The component source
├── ww-config.js             ← Component configuration
├── package.json             ← Contains version + optional weweb.componentPath
└── node_modules/
    └── @weweb/cli/          ← This project

Local development:
  weweb serve → webpack-dev-server → editor loads via addWwComponent()

Push to workspace:
  weweb push → API → S3 upload → Lambda builder → component available in editor
```

### Backend API Endpoints (weweb-back)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/public/v1/workspaces/:id/projects/:id/source_codes/wwobjects/build` | POST | Push/build a coded component |
| `/public/v1/workspaces/:id/projects/:id/source_codes/wwobjects` | GET | List coded components |
| `/public/v1/workspaces/:id/projects/:id/source_codes/wwobjects/:id/versions/:id/files` | GET | Get component source files |

All authenticated via `Authorization: Bearer {selfHostSettings.privateKey}`.

## AI Rules

### NEVER
- Remove backwards compatibility for legacy `key=value` argument format
- Hardcode API URLs — always use config/env precedence
- Store credentials in plaintext without restrictive file permissions
- Add interactive prompts without checking TTY first
- Output progress/status to stdout (use stderr)

### ALWAYS
- Support `--json` flag for all commands
- Use `output.success()` / `output.error()` instead of raw `console.log()`
- Use `errors.fatal()` for unrecoverable errors (includes proper exit code)
- Check `config.loadConfig()` for auth before API calls
- Use structured error codes (not just messages)
- Follow the existing double-quote, semicolons style

## Common Pitfalls

- **Version format** — `package.json` version must match `/^[\d\.]*$/` (digits and dots only)
- **Missing ww-config** — Both `serve` and `build` require `ww-config.js` or `ww-config.json`
- **CWD dependency** — The CLI must be run from the component project root
- **serve cd's into node_modules** — `serve.js` does `shell.cd("node_modules/@weweb/cli/")`
- **tmp-build cleanup** — Build creates `tmp-build/index.js`, cleaned after webpack finishes
- **CommonJS CLI, ES modules in generated code** — CLI uses `require()`, generated `index.js` uses `import`
- **Auth required for push** — Must run `weweb auth login` first or set env vars
- **publicAPI feature flag** — The workspace must have the `publicAPI` feature enabled for push to work
