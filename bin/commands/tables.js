const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function parseJson(str, what = "--data") {
    if (!str) return null;
    try { return JSON.parse(str); } catch {
        throw Object.assign(new Error(`Invalid JSON in ${what}`), { status: 400, code: "BAD_JSON" });
    }
}

async function list(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/tables", {});
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function getRows(tableName, options) {
    await aiApi.run(async () => {
        const body = {
            tableName,
            limit: options.limit ? Number(options.limit) : undefined,
            offset: options.offset ? Number(options.offset) : undefined,
            sort: parseJson(options.sort, "--sort") || undefined,
            filters: parseJson(options.filters, "--filters") || undefined,
        };
        const data = await aiApi.post(options, "/tables/rows", body);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function alter(options) {
    const payload = parseJson(options.data, "--data");
    if (!payload) throw Object.assign(new Error("--data is required"), { status: 400, code: "MISSING_DATA" });
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/tables/alter", payload);
        aiApi.emit(`Table altered (${payload.action})`, data);
    });
}

async function rowAdd(tableName, options) {
    const data = parseJson(options.data, "--data");
    if (!data) throw Object.assign(new Error("--data is required"), { status: 400, code: "MISSING_DATA" });
    await aiApi.run(async () => {
        const result = await aiApi.post(options, "/tables/row/add", { tableName, data });
        aiApi.emit("Row added", result);
    });
}

async function rowUpdate(tableName, id, options) {
    const data = parseJson(options.data, "--data");
    if (!data) throw Object.assign(new Error("--data is required"), { status: 400, code: "MISSING_DATA" });
    await aiApi.run(async () => {
        const result = await aiApi.post(options, "/tables/row/update", { tableName, id, data });
        aiApi.emit("Row updated", result);
    });
}

async function rowDelete(tableName, id, options) {
    await aiApi.run(async () => {
        const result = await aiApi.post(options, "/tables/row/delete", { tableName, id });
        aiApi.emit("Row deleted", result);
    });
}

async function viewsList(options) {
    await aiApi.run(async () => {
        const body = { tableId: options.tableId, tableName: options.tableName };
        const data = await aiApi.post(options, "/tables/views", body);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

async function viewData(tableViewId, options) {
    await aiApi.run(async () => {
        const body = {
            tableViewId,
            offset: options.offset ? Number(options.offset) : undefined,
            parameters: options.parameters ? parseJson(options.parameters, "--parameters") : undefined,
        };
        const data = await aiApi.post(options, "/table-views/data", body);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

// Frontend table-views search (different from backend tables/views)
async function viewsSearch(options) {
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/table-views", { search: options.search || "" });
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    });
}

module.exports = {
    list,
    getRows,
    alter,
    rowAdd,
    rowUpdate,
    rowDelete,
    viewsList,
    viewData,
    viewsSearch,
};
