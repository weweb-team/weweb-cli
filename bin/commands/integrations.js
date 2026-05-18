const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function dump(data) {
    if (output.getJsonMode()) output.json({ status: "ok", data });
    else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

async function tablesList(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/integrations/tables", {})));
}

async function tablesCreate(options) {
    const required = ["name", "integration", "config"];
    for (const key of required) {
        if (!options[key]) throw Object.assign(new Error(`--${key} is required`), { status: 400, code: "MISSING_FIELDS" });
    }
    await aiApi.run(async () => {
        const body = {
            name: options.name,
            integration: options.integration,
            connectionId: options.connectionId,
            config: options.config,
            description: options.description,
            type: options.type || "back",
        };
        const data = await aiApi.post(options, "/integrations/tables/create", body);
        aiApi.emit("Integration table created", data);
    });
}

async function tablesRename(id, options) {
    if (!options.name) throw Object.assign(new Error("--name is required"), { status: 400, code: "MISSING_NAME" });
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/integrations/tables/rename", { id, name: options.name });
        aiApi.emit("Integration table renamed", data);
    });
}

async function tablesDelete(id, options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/integrations/tables/delete", { id });
        aiApi.emit("Integration table deleted", data);
    });
}

async function connections(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/integrations/connections", {})));
}

async function projects(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/integrations/projects", {})));
}

async function authProvider(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/integrations/auth-provider", {})));
}

async function storageProvider(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/integrations/storage-provider", {})));
}

module.exports = {
    tablesList,
    tablesCreate,
    tablesRename,
    tablesDelete,
    connections,
    projects,
    authProvider,
    storageProvider,
};
