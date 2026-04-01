const shell = require("shelljs");
const prebuildCore = require("../core/prebuild.js");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

/**
 * weweb serve
 */
function serve(options) {
    const port = options.port || "8080";

    if (!prebuildCore.prebuild("serve", { port })) {
        errors.buildError("Prebuild failed. Check that ww-config.js(on) and component file exist.");
        return;
    }

    shell.cd("node_modules/@weweb/cli/");

    const cmd = `npx webpack-dev-server --config webpack.dev.config.js --env=dev --port=${port}`;
    const childProcess = shell.exec(cmd, { async: true });

    childProcess.stdout.on("data", (data) => {
        if (data.indexOf("Compiled successfully") !== -1) {
            output.success(`Server running on port ${port}`, { port, url: `https://localhost:${port}/` });
        }
    });
}

module.exports = { serve };
