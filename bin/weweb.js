#! /usr/bin/env node

const { program } = require("commander");
const pkg = require("../package.json");
const output = require("./utils/output.js");

program
    .name("weweb")
    .description("WeWeb CLI — build, serve, push, and pull components")
    .version(pkg.version, "-V, --version")
    .option("--json", "Output as JSON (machine-readable)")
    .option("--no-color", "Disable ANSI colors")
    .option("--verbose", "Verbose output")
    .hook("preAction", (thisCommand) => {
        const opts = thisCommand.optsWithGlobals();
        if (opts.json) output.setJsonMode(true);
    });

// Auth commands
const auth = program.command("auth").description("Manage authentication");

const authModule = require("./commands/auth.js");
auth
    .command("login")
    .description("Authenticate to WeWeb")
    .option("--api-key <key>", "API key (ww-private-xxx)")
    .option("--workspace-id <id>", "Workspace ID")
    .option("--api-url <url>", "API URL override")
    .action(authModule.login);

auth
    .command("logout")
    .description("Clear stored credentials")
    .action(authModule.logout);

auth
    .command("status")
    .description("Show current authentication state")
    .action(authModule.status);

// Serve command
const serveModule = require("./commands/serve.js");
program
    .command("serve")
    .description("Start local development server")
    .option("-p, --port <port>", "Dev server port", "8080")
    .action(serveModule.serve);

// Build command
const buildModule = require("./commands/build.js");
program
    .command("build")
    .description("Build component for distribution")
    .requiredOption("-n, --name <name>", "Component name")
    .requiredOption("-t, --type <type>", "Component type (section, wwobject, plugin)")
    .action(buildModule.build);

// Push command
const pushModule = require("./commands/push.js");
program
    .command("push")
    .description("Push component to WeWeb workspace")
    .requiredOption("-p, --project <id>", "Target project ID")
    .option("-c, --component <id>", "Existing component ID to update")
    .option("-m, --message <msg>", "Commit message", "Pushed via CLI")
    .option("--no-activate", "Do not auto-activate the new version")
    .action(pushModule.push);

// Pull command
const pullModule = require("./commands/pull.js");
program
    .command("pull")
    .description("Pull component source from WeWeb workspace")
    .requiredOption("-p, --project <id>", "Target project ID")
    .option("-c, --component <id>", "Component ID to pull (omit to list)")
    .option("--version-id <id>", "Specific version ID (default: active)")
    .option("-o, --output <dir>", "Output directory", ".")
    .option("--force", "Overwrite existing files")
    .action(pullModule.pull);

// =============================================================================
// AI / Project edit surface — intended to be driven by IDE agents (Claude Code,
// Cursor, Codex). Every command supports the root --json flag (output mode) and
// inherits --project / --workspace from CLI flags, WEWEB_PROJECT_ID /
// WEWEB_WORKSPACE_ID env vars, or the project-local .weweb/config.json written
// by `weweb init`. Payloads go through --data (not --json, which collides with
// the root output-mode flag).
// =============================================================================

// Common options applied to every AI subcommand
function withContext(cmd) {
    return cmd
        .option("-p, --project <id>", "Project ID")
        .option("--workspace <id>", "Workspace ID");
}

// --- pages --------------------------------------------------------------
const pagesModule = require("./commands/pages.js");
const pages = program.command("pages").description("Pages: list, get, create, update");
withContext(pages.command("list")).option("--search <s>").action(pagesModule.list);
withContext(pages.command("get <pageId>")).action(pagesModule.get);
withContext(pages.command("describe <pageId>")).action(pagesModule.describe);
withContext(pages.command("create")).option("--data <params>", "Page params JSON").action(pagesModule.create);
withContext(pages.command("update <pageId>")).option("--data <params>", "Page params JSON").action(pagesModule.update);

// --- elements -----------------------------------------------------------
const elementsModule = require("./commands/elements.js");
const elements = program.command("elements").description("Page elements: list, describe, add, edit, delete, move, replace");
withContext(elements.command("list"))
    .requiredOption("--page-id <id>", "Page ID")
    .option("--uids <csv>", "Comma-separated element UIDs to fetch (sections are excluded unless explicitly requested by uid)")
    .action(elementsModule.list);
elements.command("describe <tag>")
    .description("Print the bundled documentation JSON for an element type (e.g. ww-text, ww-section)")
    .action(elementsModule.describe);
withContext(elements.command("add"))
    .requiredOption("--page-id <id>")
    .option("--parent-id <id>", "UID of the parent element. Omit to add top-level ww-section(s) directly on the page.")
    .option("--slot <key>", "Slot key (children for most parents, wwObjects for sections)", "children")
    .option("--previous-id <id>", "Insert after this element UID (omit to insert at the start)")
    .requiredOption("--data <elements>", "Array of element JSON")
    .action(elementsModule.add);
withContext(elements.command("edit <uid>"))
    .requiredOption("--page-id <id>")
    .requiredOption("--path <path>", "Dot-path inside the element (e.g. content.default._ww-text_fontSize)")
    .option("--value <value>", "Value (string/number/bool/null/JSON)")
    .action(elementsModule.edit);
withContext(elements.command("delete <uid>"))
    .requiredOption("--page-id <id>")
    .option("--parent-id <id>", "Parent element UID (helps the API update the parent's children array)")
    .action(elementsModule.delete);
withContext(elements.command("move <uid>"))
    .requiredOption("--page-id <id>")
    .requiredOption("--old-parent-id <id>", "Current parent UID")
    .requiredOption("--new-parent-id <id>", "Target parent UID")
    .option("--slot <key>", "Slot key under the new parent", "children")
    .option("--previous-id <id>", "Insert after this element UID under the new parent")
    .action(elementsModule.move);
withContext(elements.command("replace <uid>"))
    .requiredOption("--page-id <id>")
    .requiredOption("--data <elements>", "Replacement element JSON array")
    .action(elementsModule.replace);

// --- variables ----------------------------------------------------------
const variablesModule = require("./commands/variables.js");
const variables = program.command("variables").description("Project variables");
withContext(variables.command("list")).option("--search <s>").action(variablesModule.list);
withContext(variables.command("create")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(variablesModule.create);
withContext(variables.command("edit")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(variablesModule.edit);
withContext(variables.command("delete")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(variablesModule.delete);

// --- workflows ----------------------------------------------------------
const workflowsModule = require("./commands/workflows.js");
const workflows = program.command("workflows").description("Frontend workflows (page/app/global)");
withContext(workflows.command("list"))
    .option("--type <type>", "function | page | app | any", "any")
    .option("--page-id <id>")
    .option("--uids <csv>")
    .option("--search <s>")
    .action(workflowsModule.list);
withContext(workflows.command("create")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(workflowsModule.create);
withContext(workflows.command("edit")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(workflowsModule.edit);
withContext(workflows.command("delete")).requiredOption("--page-id <id>").requiredOption("--data <params>").action(workflowsModule.delete);

// --- design-system ------------------------------------------------------
const dsModule = require("./commands/design-system.js");
const ds = program.command("design-system").description("Design system: tokens, classes, subclasses, guidelines");
withContext(ds.command("get")).action(dsModule.get);
withContext(ds.command("tokens-create")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.tokensCreate);
withContext(ds.command("tokens-edit")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.tokensEdit);
withContext(ds.command("tokens-delete")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.tokensDelete);
withContext(ds.command("classes-create")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.classesCreate);
withContext(ds.command("classes-edit")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.classesEdit);
withContext(ds.command("classes-delete")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.classesDelete);
withContext(ds.command("subclasses-create")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.subclassesCreate);
withContext(ds.command("subclasses-edit")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.subclassesEdit);
withContext(ds.command("subclasses-delete")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.subclassesDelete);
withContext(ds.command("guidelines-edit")).requiredOption("--data <params>").option("--page-id <id>").action(dsModule.guidelinesEdit);

// --- tables (backend) ---------------------------------------------------
const tablesModule = require("./commands/tables.js");
const tables = program.command("tables").description("Backend tables, rows, views");
withContext(tables.command("list")).action(tablesModule.list);
withContext(tables.command("rows <tableName>"))
    .option("--limit <n>")
    .option("--offset <n>")
    .option("--sort <json>")
    .option("--filters <json>")
    .action(tablesModule.getRows);
withContext(tables.command("alter")).requiredOption("--data <params>", "alter payload").action(tablesModule.alter);
withContext(tables.command("row-add <tableName>")).requiredOption("--data <row>").action(tablesModule.rowAdd);
withContext(tables.command("row-update <tableName> <id>")).requiredOption("--data <row>").action(tablesModule.rowUpdate);
withContext(tables.command("row-delete <tableName> <id>")).action(tablesModule.rowDelete);
withContext(tables.command("views-list")).option("--table-id <id>").option("--table-name <name>").action(tablesModule.viewsList);
withContext(tables.command("view-data <tableViewId>")).option("--offset <n>").option("--parameters <json>").action(tablesModule.viewData);
withContext(tables.command("views-search")).option("--search <s>").action(tablesModule.viewsSearch);

// --- env-vars -----------------------------------------------------------
const envVarsModule = require("./commands/env-vars.js");
const envVars = program.command("env-vars").description("Environment variables");
withContext(envVars.command("list")).action(envVarsModule.list);
withContext(envVars.command("create <name>"))
    .option("--editor <v>").option("--staging <v>").option("--production <v>")
    .option("--connection-id <id>").option("--secure")
    .action(envVarsModule.create);
withContext(envVars.command("update <name>"))
    .option("--editor <v>").option("--staging <v>").option("--production <v>")
    .option("--connection-id <id>").option("--secure")
    .action(envVarsModule.update);
withContext(envVars.command("delete <name>")).action(envVarsModule.delete);

// --- backend-workflows --------------------------------------------------
const bwfModule = require("./commands/backend-workflows.js");
const bwf = program.command("backend-workflows").description("Backend workflows");
withContext(bwf.command("list")).action(bwfModule.list);
withContext(bwf.command("get <id>")).action(bwfModule.get);
withContext(bwf.command("create")).requiredOption("--data <params>").action(bwfModule.create);
withContext(bwf.command("edit")).requiredOption("--data <params>").action(bwfModule.edit);
withContext(bwf.command("delete")).requiredOption("--data <params>").action(bwfModule.delete);

// --- auth-providers -----------------------------------------------------
const apModule = require("./commands/auth-providers.js");
const ap = program.command("auth-providers").description("Auth providers, roles, users");
withContext(ap.command("installed")).action(apModule.installed);
withContext(ap.command("install <name>"))
    .option("--editor <v>").option("--staging <v>").option("--production <v>")
    .action(apModule.install);
withContext(ap.command("update <name>"))
    .option("--editor <v>").option("--staging <v>").option("--production <v>")
    .action(apModule.update);
withContext(ap.command("delete <name>")).action(apModule.delete);
withContext(ap.command("roles-list")).action(apModule.rolesList);
withContext(ap.command("roles-create <name>")).action(apModule.rolesCreate);
withContext(ap.command("roles-delete <name>")).action(apModule.rolesDelete);
withContext(ap.command("users-list"))
    .option("--search <s>").option("--limit <n>").option("--offset <n>")
    .action(apModule.usersList);
withContext(ap.command("users-create"))
    .requiredOption("--email <e>").requiredOption("--password <p>").requiredOption("--name <n>")
    .option("--image <url>")
    .action(apModule.usersCreate);

// --- integrations -------------------------------------------------------
const integrationsModule = require("./commands/integrations.js");
const integrations = program.command("integrations").description("Integration tables, connections, providers");
withContext(integrations.command("tables-list")).action(integrationsModule.tablesList);
withContext(integrations.command("tables-create"))
    .requiredOption("--name <n>")
    .requiredOption("--integration <i>")
    .requiredOption("--config <json>")
    .option("--connection-id <id>").option("--description <d>").option("--type <t>")
    .action(integrationsModule.tablesCreate);
withContext(integrations.command("tables-rename <id>")).requiredOption("--name <n>").action(integrationsModule.tablesRename);
withContext(integrations.command("tables-delete <id>")).action(integrationsModule.tablesDelete);
withContext(integrations.command("connections")).action(integrationsModule.connections);
withContext(integrations.command("projects")).action(integrationsModule.projects);
withContext(integrations.command("auth-provider")).action(integrationsModule.authProvider);
withContext(integrations.command("storage-provider")).action(integrationsModule.storageProvider);

// --- icons --------------------------------------------------------------
const iconsModule = require("./commands/icons.js");
const icons = program.command("icons").description("Icon sets");
withContext(icons.command("common")).action(iconsModule.common);
withContext(icons.command("project")).action(iconsModule.project);
withContext(icons.command("activate <iconSet>")).action(iconsModule.activate);

// --- init ---------------------------------------------------------------
const initModule = require("./commands/init.js");
program
    .command("init")
    .description("Bootstrap a directory with CLAUDE.md, .claude/skills/*, and .weweb/config.json")
    .option("-p, --project <id>", "Project ID to bind this directory to")
    .option("--workspace <id>", "Workspace ID")
    .option("--force", "Overwrite existing files")
    .action(initModule.init);

// Legacy support: handle old-style arguments (serve/build without --)
// e.g., `weweb serve` with `port=8080` as raw arg
const args = process.argv.slice(2);
const hasLegacyArgs = args.some(a => a.includes("=") && !a.startsWith("-"));
if (hasLegacyArgs && (args[0] === "serve" || args[0] === "build")) {
    // Convert legacy `key=value` args to `--key value`
    const converted = [process.argv[0], process.argv[1]];
    for (const arg of args) {
        const eqIndex = arg.indexOf("=");
        if (eqIndex > 0 && !arg.startsWith("-")) {
            const key = arg.substring(0, eqIndex);
            const value = arg.substring(eqIndex + 1).replace(/["']/g, "");
            converted.push(`--${key}`, value);
        } else {
            converted.push(arg);
        }
    }
    program.parse(converted);
} else {
    program.parse();
}
