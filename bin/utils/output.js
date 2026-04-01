const isInteractive = process.stdout.isTTY && process.stderr.isTTY;
const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI);

let jsonMode = false;

function setJsonMode(enabled) {
    jsonMode = enabled;
}

function getJsonMode() {
    return jsonMode;
}

/**
 * Print a success result to stdout.
 * In JSON mode: structured JSON object.
 * In human mode: formatted message.
 */
function success(message, data = {}) {
    if (jsonMode) {
        console.log(JSON.stringify({ status: "ok", ...data }));
    } else {
        console.log(`\x1b[32m\u2713\x1b[0m ${message}`);
        for (const [key, value] of Object.entries(data)) {
            if (key === "status") continue;
            console.log(`  ${key}: ${value}`);
        }
    }
}

/**
 * Print an error to stderr (human) or stdout (JSON).
 */
function error(message, code = "ERROR", details = {}) {
    if (jsonMode) {
        console.log(JSON.stringify({ status: "error", code, message, ...details }));
    } else {
        console.error(`\x1b[31m\u2717\x1b[0m ${message}`);
        for (const [key, value] of Object.entries(details)) {
            if (key === "status" || key === "code") continue;
            console.error(`  ${key}: ${value}`);
        }
    }
}

/**
 * Print progress/info to stderr (never captured by pipes).
 * Suppressed in JSON mode.
 */
function info(message) {
    if (!jsonMode) {
        console.error(`\x1b[34mi\x1b[0m ${message}`);
    }
}

/**
 * Print a warning to stderr.
 * Suppressed in JSON mode.
 */
function warn(message) {
    if (!jsonMode) {
        console.error(`\x1b[33m!\x1b[0m ${message}`);
    }
}

/**
 * Print raw JSON result to stdout (for --json mode data output).
 */
function json(data) {
    console.log(JSON.stringify(data, null, 2));
}

module.exports = {
    isInteractive,
    isCI,
    setJsonMode,
    getJsonMode,
    success,
    error,
    info,
    warn,
    json,
};
