const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

async function list(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/env-variables", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function upsert(action, name, options) {
    if (!name) throw Object.assign(new Error("name is required"), { status: 400, code: "MISSING_NAME" });
    await aiApi.run(async () => {
        const body = {
            name,
            editorValue: options.editor,
            stagingValue: options.staging,
            productionValue: options.production,
            connectionId: options.connectionId,
            secure: options.secure === undefined ? undefined : options.secure !== false,
        };
        const data = await aiApi.post(options, `/env-variables/${action}`, body);
        aiApi.emit(`Env var ${action}d`, data);
    });
}

async function del(name, options) {
    if (!name) throw Object.assign(new Error("name is required"), { status: 400, code: "MISSING_NAME" });
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/env-variables/delete", { name });
        aiApi.emit("Env var deleted", data);
    });
}

module.exports = {
    list,
    create: (name, options) => upsert("create", name, options),
    update: (name, options) => upsert("update", name, options),
    delete: del,
};
