#! /usr/bin/env node

const serveCtrl = require("./controllers/serve.js");
const buildCtrl = require("./controllers/build.js");

const command = process.argv[2];

const findArgv = (argvName) => {
    for (const argv of process.argv) {
        const s = `${argvName}=`;
        if (argv.indexOf(s) === 0) {
            return argv.replace(s, "").replace(/["']/g, "");
        }
    }

    try {
        const npm_config_argv = JSON.parse(process.env.npm_config_argv);
        const original = npm_config_argv.original;
        for (const argv of original) {
            const s = `${argvName}=`;

            if (argv.indexOf(s) === 0) {
                return argv.replace(s, "").replace(/["']/g, "");
            }
        }
    } catch (error) {}

    return null;
};

switch (command) {
    case "serve":
        let port = findArgv("port") || "8080";
        serveCtrl.serve(port);
        break;
    case "build":
        const name = findArgv("name");
        const type = findArgv("type");

        buildCtrl.build(name, type);
        break;
    default:
        console.log(`Command not recognized or no specified.\nUse 'serve [-- port=port]', 'build -- name=name'.`);
}
