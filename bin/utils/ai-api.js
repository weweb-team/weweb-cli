const config = require("./config.js");
const api = require("./api.js");
const errors = require("./errors.js");
const output = require("./output.js");

/**
 * Resolve workspaceId and projectId from CLI options, env vars, or local config.
 *
 * Precedence: --workspace / --project flag  >  env var  >  ~/.weweb/config.json
 *                                          >  ./.weweb/config.json (project-local, written by `weweb init`)
 */
function resolveContext(options) {
    const cfg = config.loadConfig();

    if (!cfg.apiKey) errors.authError();

    const workspaceId =
        options.workspace ||
        process.env.WEWEB_WORKSPACE_ID ||
        cfg.workspaceId ||
        loadProjectConfig().workspaceId;

    const projectId =
        options.project ||
        process.env.WEWEB_PROJECT_ID ||
        loadProjectConfig().projectId;

    if (!workspaceId) {
        errors.fatal(
            "Workspace ID is required. Use --workspace <id> or run `weweb auth login`.",
            "MISSING_WORKSPACE",
            errors.EXIT_ERROR
        );
    }
    if (!projectId) {
        errors.fatal(
            "Project ID is required. Use --project <id>, set WEWEB_PROJECT_ID, or run `weweb init`.",
            "MISSING_PROJECT",
            errors.EXIT_ERROR
        );
    }

    return { workspaceId, projectId };
}

function basePath(options) {
    const { workspaceId, projectId } = resolveContext(options);
    return `/public/v1/workspaces/${workspaceId}/projects/${projectId}/ai`;
}

function loadProjectConfig() {
    const fs = require("fs");
    const path = require("path");
    const file = path.resolve(".weweb/config.json");
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        // ignore
    }
    return {};
}

/**
 * Run a function, mapping API errors to clean fatal exits with appropriate codes.
 */
async function run(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err.status === 401) {
            errors.fatal("Authentication failed. Check your API key.", "AUTH_FAILED", errors.EXIT_AUTH);
        } else if (err.status === 402 || err.status === 403) {
            errors.fatal(
                err.body?.code || "Public AI API not enabled on this workspace.",
                err.code || "FEATURE_DISABLED",
                errors.EXIT_AUTH
            );
        } else if (err.status === 404) {
            errors.fatal(err.message || "Not found.", err.code || "NOT_FOUND", 6);
        } else if (err.status === 429) {
            errors.fatal("Rate or quota limit exceeded.", "QUOTA_EXCEEDED", 5);
        } else if (err.status === 400) {
            errors.fatal(err.message || "Invalid request.", err.code || "INVALID_OPERATION", 7, {
                body: err.body,
            });
        } else {
            errors.fatal(
                err.message || "Request failed.",
                err.code || "REQUEST_FAILED",
                errors.EXIT_ERROR,
                { status: err.status, body: err.body }
            );
        }
    }
}

/**
 * Emit a payload either as raw JSON (--json mode) or as `output.success` with the data attached.
 */
function emit(label, data) {
    if (output.getJsonMode()) {
        output.json({ status: "ok", data });
    } else {
        output.success(label, typeof data === "object" && !Array.isArray(data) ? data : { count: Array.isArray(data) ? data.length : 1 });
    }
}

module.exports = {
    resolveContext,
    basePath,
    run,
    emit,
    get: (options, suffix) => api.get(`${basePath(options)}${suffix}`),
    post: (options, suffix, body) => api.post(`${basePath(options)}${suffix}`, body),
};
