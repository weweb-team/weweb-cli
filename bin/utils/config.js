const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".weweb");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_API_URL = "https://api.weweb.io/v1";

/**
 * Load config from file, merged with env vars.
 * Precedence: env vars > config file > defaults.
 */
function loadConfig() {
    let fileConfig = {};
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        }
    } catch {
        // Ignore corrupt config
    }

    return {
        apiKey: process.env.WEWEB_API_KEY || fileConfig.apiKey || null,
        apiUrl: process.env.WEWEB_API_URL || fileConfig.apiUrl || DEFAULT_API_URL,
        workspaceId: process.env.WEWEB_WORKSPACE_ID || fileConfig.workspaceId || null,
    };
}

/**
 * Save config to ~/.weweb/config.json with restricted permissions.
 */
function saveConfig(config) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { mode: 0o700 });
    }

    const existing = loadFileConfig();
    const merged = { ...existing, ...config };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

/**
 * Load raw file config (without env var overrides).
 */
function loadFileConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        }
    } catch {
        // Ignore
    }
    return {};
}

/**
 * Clear credentials from config file.
 */
function clearCredentials() {
    const config = loadFileConfig();
    delete config.apiKey;
    delete config.workspaceId;

    if (!fs.existsSync(CONFIG_DIR)) return;

    if (Object.keys(config).length === 0) {
        try {
            fs.unlinkSync(CONFIG_FILE);
        } catch {
            // Ignore
        }
    } else {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    }
}

/**
 * Check if credentials are configured (from any source).
 */
function hasCredentials() {
    const config = loadConfig();
    return !!(config.apiKey && config.workspaceId);
}

module.exports = {
    CONFIG_DIR,
    CONFIG_FILE,
    DEFAULT_API_URL,
    loadConfig,
    saveConfig,
    loadFileConfig,
    clearCredentials,
    hasCredentials,
};
