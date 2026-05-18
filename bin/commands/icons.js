const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

function dump(data) {
    if (output.getJsonMode()) output.json({ status: "ok", data });
    else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

async function common(options) {
    await aiApi.run(async () => dump(await aiApi.get(options, "/icons/common")));
}

async function project(options) {
    await aiApi.run(async () => dump(await aiApi.post(options, "/icons/project", {})));
}

async function activate(iconSet, options) {
    if (!iconSet) throw Object.assign(new Error("iconSet is required"), { status: 400, code: "MISSING_ICONSET" });
    await aiApi.run(async () => {
        const data = await aiApi.post(options, "/icons/activate", { iconSet });
        aiApi.emit(`Icon set activated: ${iconSet}`, data);
    });
}

module.exports = { common, project, activate };
