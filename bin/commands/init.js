const fs = require("fs");
const path = require("path");
const config = require("../utils/config.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

const TEMPLATES_DIR = path.resolve(__dirname, "..", "..", "templates");

/**
 * weweb init [-p <projectId>] [--workspace <id>] [--force]
 *
 * Bootstraps the current directory with:
 *   - CLAUDE.md            (project orientation for the IDE agent)
 *   - .claude/skills/*.md  (12 WeWeb skill files Claude Code auto-loads on demand)
 *   - .weweb/config.json   ({ projectId, workspaceId } pointer)
 *
 * Idempotent. If files exist, refuses to overwrite unless --force is set.
 * Credentials live in ~/.weweb/config.json (set via `weweb auth login`); this
 * command only writes the project-local pointer.
 */
async function init(options) {
    const cwd = process.cwd();

    const cfg = config.loadConfig();
    const projectId = options.project || process.env.WEWEB_PROJECT_ID;
    const workspaceId = options.workspace || cfg.workspaceId || process.env.WEWEB_WORKSPACE_ID;

    if (!projectId) {
        errors.fatal(
            "Project ID is required. Use --project <id> or set WEWEB_PROJECT_ID.",
            "MISSING_PROJECT",
            errors.EXIT_ERROR
        );
    }
    if (!workspaceId) {
        errors.fatal(
            "Workspace ID is required. Run `weweb auth login` first or pass --workspace <id>.",
            "MISSING_WORKSPACE",
            errors.EXIT_ERROR
        );
    }

    const targets = collectTargets(cwd, { projectId, workspaceId });

    const existing = targets.filter(t => fs.existsSync(t.dest));
    if (existing.length > 0 && !options.force) {
        errors.fatal(
            `${existing.length} file(s) already exist. Re-run with --force to overwrite.\n  ${existing.map(t => path.relative(cwd, t.dest)).join("\n  ")}`,
            "FILES_EXIST",
            errors.EXIT_ERROR
        );
    }

    if (existing.length > 0) {
        output.warn(`Overwriting ${existing.length} existing file(s).`);
    }

    for (const t of targets) {
        fs.mkdirSync(path.dirname(t.dest), { recursive: true });
        fs.writeFileSync(t.dest, t.content, "utf8");
    }

    output.success(`Initialized WeWeb project (${targets.length} files written).`, {
        projectId,
        workspaceId,
        cwd,
    });
}

function collectTargets(cwd, { projectId, workspaceId }) {
    const targets = [];

    // CLAUDE.md
    targets.push({
        dest: path.join(cwd, "CLAUDE.md"),
        content: fs.readFileSync(path.join(TEMPLATES_DIR, "CLAUDE.md"), "utf8"),
    });

    // .claude/skills/*.md
    const skillsSrc = path.join(TEMPLATES_DIR, "skills");
    const skillFiles = fs.readdirSync(skillsSrc).filter(f => f.endsWith(".md"));
    for (const file of skillFiles) {
        targets.push({
            dest: path.join(cwd, ".claude", "skills", file),
            content: fs.readFileSync(path.join(skillsSrc, file), "utf8"),
        });
    }

    // .weweb/config.json
    targets.push({
        dest: path.join(cwd, ".weweb", "config.json"),
        content: JSON.stringify({ projectId, workspaceId }, null, 2) + "\n",
    });

    return targets;
}

module.exports = { init };
