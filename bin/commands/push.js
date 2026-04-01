const path = require("path");
const config = require("../utils/config.js");
const api = require("../utils/api.js");
const files = require("../utils/files.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

/**
 * weweb push
 */
async function push(options) {
    const cfg = config.loadConfig();

    // Check auth
    if (!cfg.apiKey || !cfg.workspaceId) {
        errors.authError();
    }

    const projectId = options.project || process.env.WEWEB_PROJECT_ID;
    if (!projectId) {
        errors.fatal(
            "Project ID is required. Use --project <id> or set WEWEB_PROJECT_ID.",
            "MISSING_PROJECT",
            errors.EXIT_ERROR
        );
    }

    const componentId = options.component || null;
    const commitMessage = options.message || "Pushed via CLI";
    const autoActivate = options.activate !== false;
    const projectDir = process.cwd();

    // Collect files
    output.info("Collecting component files...");
    let fileMap;
    try {
        fileMap = files.collectFiles(projectDir);
    } catch (err) {
        errors.fatal(err.message, "FILE_ERROR", errors.EXIT_ERROR);
        return;
    }

    // Detect component
    const componentPath = files.detectComponentPath(projectDir);
    if (!componentPath) {
        errors.fatal(
            "No component entry found. Expected src/wwElement.vue, src/wwSection.vue, or src/wwPlugin.js.",
            "NO_COMPONENT",
            errors.EXIT_ERROR
        );
        return;
    }

    // Validate package.json version
    let pkg;
    try {
        pkg = JSON.parse(fileMap["package.json"]);
    } catch {
        errors.fatal("Invalid package.json format.", "PACKAGE_JSON_ERROR", errors.EXIT_ERROR);
        return;
    }

    const versionRegex = /^[\d.]+$/;
    if (!versionRegex.test(pkg.version)) {
        errors.fatal(
            `Invalid version '${pkg.version}'. Must be digits and dots only (e.g., 1.0.4).`,
            "INVALID_VERSION",
            errors.EXIT_ERROR
        );
        return;
    }

    const fileCount = Object.keys(fileMap).length;
    output.info(`Found ${fileCount} files. Component: ${componentPath}`);
    output.info("Pushing to workspace...");

    // Push to API
    try {
        const body = {
            files: fileMap,
            commit: commitMessage,
            autoActive: autoActivate,
        };
        if (componentId) {
            body.wwObjectBaseId = componentId;
        }

        const result = await api.post(
            `/public/v1/workspaces/${cfg.workspaceId}/projects/${projectId}/source_codes/wwobjects/build`,
            body
        );

        output.success("Component pushed successfully.", {
            name: result.name || pkg.name,
            id: result.id,
            versionId: result.versionId,
            version: result.version,
            commit: result.commit || commitMessage,
        });
    } catch (err) {
        if (err.status === 401) {
            errors.fatal("Authentication failed. Check your API key.", "AUTH_FAILED", errors.EXIT_AUTH);
        } else if (err.status === 402) {
            errors.fatal("Public API feature not enabled on this workspace.", "FEATURE_DISABLED", errors.EXIT_AUTH);
        } else if (err.status === 404) {
            errors.fatal(
                "Project not found or not linked to this workspace.",
                "PROJECT_NOT_FOUND",
                errors.EXIT_ERROR
            );
        } else if (err.status === 429) {
            errors.fatal("Rate limit exceeded. Please wait and try again.", "RATE_LIMITED", errors.EXIT_ERROR);
        } else {
            errors.fatal(
                err.message || "Push failed.",
                err.code || "PUSH_FAILED",
                errors.EXIT_BUILD,
                { status: err.status }
            );
        }
    }
}

module.exports = { push };
