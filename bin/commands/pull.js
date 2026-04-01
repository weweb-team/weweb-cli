const fs = require("fs");
const path = require("path");
const config = require("../utils/config.js");
const api = require("../utils/api.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

// Metadata files returned by the API that are not user source code
const SKIP_FILES = ["AI.json"];

/**
 * weweb pull
 */
async function pull(options) {
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

    const basePath = `/public/v1/workspaces/${cfg.workspaceId}/projects/${projectId}/source_codes/wwobjects`;

    // Fetch component list
    let components;
    try {
        components = await api.get(basePath);
    } catch (err) {
        handleApiError(err, "fetch components");
    }

    if (!Array.isArray(components)) {
        errors.fatal("Unexpected API response.", "API_ERROR", errors.EXIT_ERROR);
    }

    // List mode: no --component provided
    if (!options.component) {
        const items = components
            .filter(c => !c.archived)
            .map(c => {
                const active = (c.WwObjectBaseVersions || []).find(v => v.active);
                return {
                    id: c.id,
                    name: c.name,
                    version: active ? active.version : null,
                    packageVersion: active ? active.packageVersion : null,
                    versionId: active ? active.id : null,
                };
            });

        if (output.getJsonMode()) {
            output.json({ status: "ok", components: items });
        } else {
            if (items.length === 0) {
                output.info("No components found in this project.");
            } else {
                output.info(`Found ${items.length} component(s):\n`);
                for (const item of items) {
                    const ver = item.packageVersion || item.version || "—";
                    console.error(`  ${item.id}  ${item.name}  (v${ver})`);
                }
                console.error("");
                output.info("Use --component <id> to pull a component.");
            }
        }
        return;
    }

    // Pull mode: resolve component and version
    const component = components.find(c => c.id === options.component);
    if (!component) {
        errors.fatal(
            `Component '${options.component}' not found in this project.`,
            "COMPONENT_NOT_FOUND",
            errors.EXIT_ERROR
        );
    }

    const versions = component.WwObjectBaseVersions || [];
    let version;
    if (options.versionId) {
        version = versions.find(v => v.id === options.versionId);
        if (!version) {
            errors.fatal(
                `Version '${options.versionId}' not found for this component.`,
                "VERSION_NOT_FOUND",
                errors.EXIT_ERROR
            );
        }
    } else {
        version = versions.find(v => v.active);
        if (!version) {
            errors.fatal(
                "No active version found for this component.",
                "NO_ACTIVE_VERSION",
                errors.EXIT_ERROR
            );
        }
    }

    // Fetch files
    output.info(`Pulling ${component.name} v${version.packageVersion || version.version}...`);
    let fileMap;
    try {
        fileMap = await api.get(`${basePath}/${component.id}/versions/${version.id}/files`);
    } catch (err) {
        handleApiError(err, "fetch files");
    }

    if (!fileMap || typeof fileMap !== "object") {
        errors.fatal("Unexpected API response for files.", "API_ERROR", errors.EXIT_ERROR);
    }

    // Filter out metadata files
    for (const skip of SKIP_FILES) {
        delete fileMap[skip];
    }

    const filePaths = Object.keys(fileMap);
    if (filePaths.length === 0) {
        output.warn("No source files found for this component version.");
        return;
    }

    // Resolve output directory
    const outputDir = path.resolve(options.output || ".");

    // Path traversal protection + overwrite check
    const existing = [];
    for (const filePath of filePaths) {
        const target = path.resolve(outputDir, filePath);
        if (!target.startsWith(outputDir + path.sep) && target !== outputDir) {
            errors.fatal(
                `Unsafe file path detected: ${filePath}`,
                "UNSAFE_PATH",
                errors.EXIT_ERROR
            );
        }
        if (fs.existsSync(target)) {
            existing.push(filePath);
        }
    }

    if (existing.length > 0 && !options.force) {
        errors.fatal(
            `${existing.length} file(s) already exist. Use --force to overwrite.\n  ${existing.join("\n  ")}`,
            "FILES_EXIST",
            errors.EXIT_ERROR
        );
    }

    if (existing.length > 0 && options.force) {
        output.warn(`Overwriting ${existing.length} existing file(s).`);
    }

    // Write files to disk
    for (const filePath of filePaths) {
        const target = path.resolve(outputDir, filePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, fileMap[filePath], "utf8");
    }

    output.success(`Pulled ${filePaths.length} file(s).`, {
        name: component.name,
        id: component.id,
        versionId: version.id,
        version: version.packageVersion || String(version.version),
        outputDir,
    });
}

function handleApiError(err, action) {
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
            err.message || `Failed to ${action}.`,
            err.code || "PULL_FAILED",
            errors.EXIT_ERROR,
            { status: err.status }
        );
    }
}

module.exports = { pull };
