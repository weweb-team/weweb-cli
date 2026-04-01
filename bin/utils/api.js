const config = require("./config.js");
const errors = require("./errors.js");

/**
 * Make an authenticated API request.
 * Uses native fetch (Node 22+).
 */
async function request(method, path, body = null) {
    const cfg = config.loadConfig();

    if (!cfg.apiKey) {
        errors.authError("No API key configured. Run 'weweb auth login' first.");
    }

    const url = `${cfg.apiUrl.replace(/\/v1$/, "")}${path}`;
    const headers = {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        let errorBody;
        try {
            errorBody = await response.json();
        } catch {
            errorBody = { message: response.statusText };
        }
        const err = new Error(errorBody.message || errorBody.code || `HTTP ${response.status}`);
        err.status = response.status;
        err.code = errorBody.code || `HTTP_${response.status}`;
        err.body = errorBody;
        throw err;
    }

    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function get(path) {
    return request("GET", path);
}

async function post(path, body) {
    return request("POST", path, body);
}

module.exports = { request, get, post };
