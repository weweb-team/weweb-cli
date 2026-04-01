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
