const readline = require("readline");
const config = require("../utils/config.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

/**
 * Prompt for input (only in interactive mode).
 */
function prompt(question, isSecret = false) {
    return new Promise((resolve, reject) => {
        if (!output.isInteractive && !output.isCI) {
            reject(new Error(`Input required but not in interactive mode: ${question}`));
            return;
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr, // Prompts go to stderr
        });

        if (isSecret) {
            // Mask input for secrets
            process.stderr.write(question);
            const stdin = process.stdin;
            const wasRaw = stdin.isRaw;
            if (stdin.setRawMode) stdin.setRawMode(true);

            let input = "";
            const onData = (char) => {
                const c = char.toString("utf8");
                if (c === "\n" || c === "\r" || c === "\u0004") {
                    if (stdin.setRawMode) stdin.setRawMode(wasRaw);
                    stdin.removeListener("data", onData);
                    process.stderr.write("\n");
                    rl.close();
                    resolve(input);
                } else if (c === "\u0003") {
                    // Ctrl+C
                    rl.close();
                    process.exit(errors.EXIT_CANCELLED);
                } else if (c === "\u007F" || c === "\b") {
                    // Backspace
                    if (input.length > 0) {
                        input = input.slice(0, -1);
                        process.stderr.write("\b \b");
                    }
                } else {
                    input += c;
                    process.stderr.write("*");
                }
            };
            stdin.on("data", onData);
        } else {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        }
    });
}

/**
 * Validate credentials by making a lightweight API call.
 */
async function validateCredentials(apiKey, workspaceId, apiUrl) {
    const url = `${apiUrl.replace(/\/v1$/, "")}/public/v1/workspaces/${workspaceId}/projects/00000000-0000-0000-0000-000000000000/deploy/last`;
    const response = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
    });

    // 404 = valid auth but no project (expected for dummy project ID)
    // 401 = invalid auth
    // 402 = publicAPI feature not enabled
    if (response.status === 401) {
        return { valid: false, reason: "Invalid API key." };
    }
    if (response.status === 402) {
        return { valid: false, reason: "Public API feature not enabled on this workspace." };
    }
    if (response.status === 404 || response.status === 200) {
        return { valid: true };
    }
    return { valid: false, reason: `Unexpected response: HTTP ${response.status}` };
}

/**
 * weweb auth login
 */
async function login(options) {
    try {
        const parentOpts = options._optionValues ? {} : {};
        let apiKey = options.apiKey || process.env.WEWEB_API_KEY;
        let workspaceId = options.workspaceId || process.env.WEWEB_WORKSPACE_ID;
        let apiUrl = options.apiUrl || process.env.WEWEB_API_URL || config.DEFAULT_API_URL;

        // Interactive prompts if missing
        if (!apiKey) {
            apiKey = await prompt("API Key: ", true);
        }
        if (!workspaceId) {
            workspaceId = await prompt("Workspace ID: ");
        }
        if (!apiUrl && output.isInteractive) {
            const input = await prompt(`API URL (${config.DEFAULT_API_URL}): `);
            if (input) apiUrl = input;
        }

        if (!apiKey || !workspaceId) {
            errors.fatal("API key and workspace ID are required.", "MISSING_CREDENTIALS", errors.EXIT_AUTH);
        }

        // Validate
        output.info("Validating credentials...");
        const result = await validateCredentials(apiKey, workspaceId, apiUrl);

        if (!result.valid) {
            errors.fatal(result.reason, "AUTH_FAILED", errors.EXIT_AUTH);
        }

        // Save
        config.saveConfig({ apiKey, workspaceId, apiUrl });

        output.success("Authenticated successfully.", {
            workspaceId,
            apiUrl,
            configFile: config.CONFIG_FILE,
        });
    } catch (err) {
        if (err.message && err.message.includes("Input required")) {
            errors.fatal(
                "Missing --api-key and --workspace-id flags (required in non-interactive mode).",
                "NON_INTERACTIVE",
                errors.EXIT_AUTH
            );
        }
        errors.fatal(err.message, "AUTH_ERROR", errors.EXIT_AUTH);
    }
}

/**
 * weweb auth logout
 */
async function logout() {
    config.clearCredentials();
    output.success("Credentials cleared.");
}

/**
 * weweb auth status
 */
async function status() {
    const cfg = config.loadConfig();

    if (cfg.apiKey && cfg.workspaceId) {
        const masked = cfg.apiKey.substring(0, 14) + "..." + cfg.apiKey.slice(-4);
        output.success("Authenticated", {
            workspaceId: cfg.workspaceId,
            apiKey: masked,
            apiUrl: cfg.apiUrl,
            configFile: config.CONFIG_FILE,
        });
    } else {
        const missing = [];
        if (!cfg.apiKey) missing.push("API key");
        if (!cfg.workspaceId) missing.push("workspace ID");
        output.error(`Not authenticated. Missing: ${missing.join(", ")}.`, "NOT_AUTHENTICATED", {
            suggestion: "Run 'weweb auth login' to authenticate.",
        });
        process.exit(errors.EXIT_AUTH);
    }
}

module.exports = { login, logout, status };
