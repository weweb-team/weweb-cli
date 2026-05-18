const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

async function installed(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/auth-providers/installed", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function install(name, options) {
    if (!name) throw Object.assign(new Error("name is required"), { status: 400, code: "MISSING_NAME" });
    await aiApi.run(async () => {
        const body = {
            name,
            editorValue: options.editor || "",
            stagingValue: options.staging,
            productionValue: options.production,
        };
        const data = await aiApi.post(options, "/auth-providers/install", body);
        aiApi.emit("Auth provider installed", data);
    });
}

async function update(name, options) {
    return install(name, options); // upsert
}

async function del(name, options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/auth-providers/delete", { name });
        aiApi.emit("Auth provider deleted", data);
    });
}

async function rolesList(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/auth-providers/roles", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function rolesCreate(name, options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/auth-providers/roles/create", { name });
        aiApi.emit("Role created", data);
    });
}

async function rolesDelete(name, options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/auth-providers/roles/delete", { name });
        aiApi.emit("Role deleted", data);
    });
}

async function usersList(options) {
    await aiApi.run(async () => {
        const body = {
            search: options.search,
            limit: options.limit ? Number(options.limit) : undefined,
            offset: options.offset ? Number(options.offset) : undefined,
        };
        const data = await aiApi.post(options, "/auth-providers/users", body);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function usersCreate(options) {
    if (!options.email || !options.password || !options.name) {
        throw Object.assign(new Error("--email, --password, --name required"), { status: 400, code: "MISSING_FIELDS" });
    }
    await aiApi.run(async () => {
        const body = {
            email: options.email,
            password: options.password,
            name: options.name,
            image: options.image,
        };
        const data = await aiApi.post(options, "/auth-providers/users/create", body);
        aiApi.emit("User created", data);
    });
}

module.exports = {
    installed,
    install,
    update,
    delete: del,
    rolesList,
    rolesCreate,
    rolesDelete,
    usersList,
    usersCreate,
};
