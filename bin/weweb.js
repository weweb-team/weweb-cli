#! /usr/bin/env node

const command = process.argv[2];
const QUOTED_ARG_BOUNDARIES = /^["']|["']$/g;

const parseArgs = () => {
    const rawArgs = process.argv.slice(3);

    try {
        const npm_config_argv = JSON.parse(process.env.npm_config_argv);
        const originalArgs = Array.isArray(npm_config_argv.original) ? npm_config_argv.original : [];
        for (const argv of originalArgs) {
            if (!rawArgs.includes(argv)) rawArgs.push(argv);
        }
    } catch (error) {}

    const args = {};

    for (let index = 0; index < rawArgs.length; index++) {
        const argv = rawArgs[index];
        if (!argv || argv === "--") continue;

        if (argv.startsWith("--")) {
            const option = argv.slice(2);
            const equalIndex = option.indexOf("=");

            if (equalIndex !== -1) {
                args[option.slice(0, equalIndex)] = option.slice(equalIndex + 1).replace(QUOTED_ARG_BOUNDARIES, "");
                continue;
            }

            const nextArg = rawArgs[index + 1];
            if (nextArg && !nextArg.startsWith("--")) {
                args[option] = nextArg.replace(QUOTED_ARG_BOUNDARIES, "");
                index++;
            } else {
                args[option] = true;
            }
            continue;
        }

        const equalIndex = argv.indexOf("=");
        if (equalIndex !== -1) {
            args[argv.slice(0, equalIndex)] = argv.slice(equalIndex + 1).replace(QUOTED_ARG_BOUNDARIES, "");
        }
    }

    return args;
};

async function main() {
    const args = parseArgs();

    switch (command) {
        case "serve":
            const serveCtrl = require("./controllers/serve.js");
            serveCtrl.serve(args.port || "8080");
            break;
        case "build":
            const buildCtrl = require("./controllers/build.js");
            buildCtrl.build(args.name, args.type);
            break;
        case "db:generate":
            const dbGenerateCtrl = require("./controllers/db.js");
            process.exitCode = await dbGenerateCtrl.generate(args);
            break;
        case "db:execute":
            const dbExecuteCtrl = require("./controllers/db.js");
            process.exitCode = await dbExecuteCtrl.execute(args);
            break;
        default:
            process.exitCode = 1;
            console.log(
                `Command not recognized or no specified.\nUse 'serve [--port=port]', 'build --name=name --type=type', 'db:generate --source-db-url url --target-db-url url --output-file file', or 'db:execute --db-url url --sql-file file'.`
            );
    }
}

main().catch(error => {
    process.exitCode = 1;
    console.error(error?.message || error);
});
