// #! /usr/bin/env node
const shell = require("shelljs");

const prebuildCore = require("../core/prebuild.js");

exports.serve = (port) => {
    if (!prebuildCore.prebuild({ port })) {
        console.log("BUILD ERROR");
    } else {
        shell.cd("node_modules/@weweb/cli/");

        const cmd = `npx webpack-dev-server --config webpack.dev.config.js -d --inline --env=dev --hot --https --disableHostCheck=true --client-log-level=error --port=${port}`;
        const childProcess = shell.exec(cmd, { async: true });

        childProcess.stdout.on("data", (data) => {
            if (data.indexOf("Compiled successfully") !== -1) {
                console.log(`\x1b[42m Server OK. \x1b[0m`);
                console.log(`\x1b[44m Running on port : ${port} \x1b[0m`);
            }
        });
    }
};
