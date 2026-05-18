const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function parseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch {
        throw Object.assign(new Error("Invalid JSON in --data"), { status: 400, code: "BAD_JSON" });
    }
}

/**
 * weweb design-system get
 */
async function get(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/library-design", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function mutate(action, options) {
    const params = parseJson(options.data) || {};
    await aiApi.run(async () => {
        const body = { action, params, userSession: { pageId: options.pageId || params.pageId } };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit(`Design system ${action}`, data);
    });
}

module.exports = {
    get,
    // Tokens
    tokensCreate: (options) => mutate("create_design_system_token", options),
    tokensEdit:   (options) => mutate("edit_design_system_token", options),
    tokensDelete: (options) => mutate("delete_design_system_token", options),
    // Classes
    classesCreate: (options) => mutate("create_design_system_class", options),
    classesEdit:   (options) => mutate("edit_design_system_class", options),
    classesDelete: (options) => mutate("delete_design_system_class", options),
    // Subclasses
    subclassesCreate: (options) => mutate("create_design_system_subclass", options),
    subclassesEdit:   (options) => mutate("edit_design_system_subclass", options),
    subclassesDelete: (options) => mutate("delete_design_system_subclass", options),
    // Guidelines
    guidelinesEdit: (options) => mutate("edit_design_system_guidelines", options),
};
