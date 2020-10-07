#! /usr/bin/env node

const serveCtrl = require("./controllers/serve.js");
// const buildCtrl = require("./controllers/build.js");
// const createConfigCtrl = require("./controllers/createConfig.js");

const command = process.argv[2];

switch (command) {
    case "serve":
        const port = process.argv[3] || "8080";
        serveCtrl.serve(port);
        break;
    case "build":
        buildCtrl.build();
        break;
    case "create-config":
        createConfigCtrl.createConfig();
        break;
    default:
        console.log(`Command not recognized or no specified.\nUse 'serve [port]', 'build' or 'create-config'.`);
}
