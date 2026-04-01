const output = require("./output.js");

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_CANCELLED = 2;
const EXIT_AUTH = 4;
const EXIT_BUILD = 8;

/**
 * Exit with a structured error.
 */
function fatal(message, code = "ERROR", exitCode = EXIT_ERROR, details = {}) {
    output.error(message, code, details);
    process.exit(exitCode);
}

function authError(message = "Not authenticated. Run 'weweb auth login' first.") {
    fatal(message, "AUTH_REQUIRED", EXIT_AUTH);
}

function buildError(message = "Build failed.") {
    fatal(message, "BUILD_FAILED", EXIT_BUILD);
}

module.exports = {
    EXIT_SUCCESS,
    EXIT_ERROR,
    EXIT_CANCELLED,
    EXIT_AUTH,
    EXIT_BUILD,
    fatal,
    authError,
    buildError,
};
