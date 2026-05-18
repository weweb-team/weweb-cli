const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

/**
 * weweb pages list [--search=…]
 */
async function list(options) {
    await aiApi.run(async () => {
        const body = { search: options.search || "" };
        const data = await aiApi.post(options, "/pages", body);
        aiApi.emit("Pages", data?.pages || data);
    });
}

/**
 * weweb pages get <pageId>
 */
async function get(pageId, options) {
    await aiApi.run(async () => {
        const data = await aiApi.get(options, `/pages/${pageId}`);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write((data?.semantic ?? JSON.stringify(data, null, 2)) + "\n");
    });
}

/**
 * weweb pages describe <pageId>
 */
async function describe(pageId, options) {
    await aiApi.run(async () => {
        const data = await aiApi.get(options, `/pages/${pageId}/description`);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write((data?.description ?? "") + "\n");
    });
}

/**
 * weweb pages create --data '{...}'
 * weweb pages update <pageId> --data '{...}'
 *
 * Both go through the `save` endpoint with action=create_page|update_page.
 */
async function save(action, pageId, options) {
    await aiApi.run(async () => {
        let params;
        try {
            params = options.data ? JSON.parse(options.data) : {};
        } catch {
            throw Object.assign(new Error("Invalid JSON in --data"), { status: 400, code: "BAD_JSON" });
        }
        if (action === "update_page") params.id = pageId;
        const body = { action, params, userSession: { pageId: action === "update_page" ? pageId : params.id } };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit(`Page ${action.split("_")[0]}d`, data);
    });
}

module.exports = {
    list,
    get,
    describe,
    create: (options) => save("create_page", null, options),
    update: (pageId, options) => save("update_page", pageId, options),
};
