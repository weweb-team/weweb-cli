const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function parseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch {
        throw Object.assign(new Error("Invalid JSON in --data"), { status: 400, code: "BAD_JSON" });
    }
}

async function list(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/backend-workflows", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function get(id, options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/backend-workflows/get", { id });
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function mutate(action, options) {
    const params = parseJson(options.data) || {};
    await aiApi.run(async () => {
        const body = { action, params, userSession: {} };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit(`Backend workflow ${action.split("_")[0]}d`, data);
    });
}

module.exports = {
    list,
    get,
    create: (options) => mutate("create_backend_workflow", options),
    edit: (options) => mutate("edit_backend_workflow", options),
    delete: (options) => mutate("delete_backend_workflow", options),
};
