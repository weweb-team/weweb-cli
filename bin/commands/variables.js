const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function parseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch {
        throw Object.assign(new Error("Invalid JSON in --data"), { status: 400, code: "BAD_JSON" });
    }
}

/**
 * weweb variables list [--search=…]
 */
async function list(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/variables", { search: options.search || "" });
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data?.variables || data, null, 2) + "\n");
    });
}

async function mutate(action, pageId, options) {
    if (!pageId) throw Object.assign(new Error("--page-id is required"), { status: 400, code: "MISSING_PAGE_ID" });
    const params = parseJson(options.data) || {};
    await aiApi.run(async () => {
        const body = { action, params, userSession: { pageId } };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit(`Variable ${action.split("_")[0]}d`, data);
    });
}

module.exports = {
    list,
    create: (options) => mutate("create_variable", options.pageId, options),
    edit: (options) => mutate("edit_variable", options.pageId, options),
    delete: (options) => mutate("delete_variable", options.pageId, options),
};
