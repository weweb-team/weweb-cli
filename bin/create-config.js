#! /usr/bin/env node
const fs = require("fs");

//TODO : Remove this
let newConfig = false;
if (process.argv.indexOf("new") !== -1) {
    newConfig = true;
}

if (!newConfig) {
    if (!fs.existsSync("./package.json")) {
        console.log('\x1b[41mError : "./package.json" was not found.\x1b[0m');
        return;
    }

    let package = fs.readFileSync("./package.json");

    try {
        package = JSON.parse(package);
    } catch (error) {
        console.log('\x1b[41mError : unable to parse "./package.json".\x1b[0m');
        return;
    }

    const types = ["section", "wwobject", "plugin"];
    if (!package.type) {
        console.log('\x1b[41mError : "type" not present in package.json.\x1b[0m');
        console.log('\x1b[41mShould be one of : "section", "wwobject", "plugin".\x1b[0m');
        return;
    }
    if (types.indexOf(package.type.toLowerCase()) === -1) {
        console.log('\x1b[41mError : "type" in package.json should be one of : "section", "wwobject", "plugin".\x1b[0m');
        return;
    }
    if (fs.existsSync("./ww-config.json")) {
        console.log('\x1b[44m"./ww-config.js" already exists.\x1b[0m');
    } else {
        if (package.type.toLowerCase() == "wwobject") {
            fs.writeFileSync(
                "./ww-config.json",
                `{` +
                    `\n    "componentPath": "./src/wwObject.vue",` +
                    `\n    "meta": {` +
                    `\n        "displayName": {` +
                    `\n            "en": "DISPLAY_NAME",` +
                    `\n            "fr": "DISPLAY_NAME"` +
                    `\n        }` +
                    `\n    },` +
                    `\n    "content": {` +
                    `\n        "type": "${package.name}",` +
                    `\n        "data": {` +
                    `\n        }` +
                    `\n    },` +
                    `\n    "upsales": {` +
                    `\n    },` +
                    `\n    "cmsOptions": {` +
                    `\n    }` +
                    `\n}`
            );
        } else {
            fs.writeFileSync("./ww-config.json", `{` + `\n    "componentPath": "./src/section.vue"` + `\n}`);
        }
    }
} else {
    fs.writeFileSync(
        "./ww-config.json",
        `{` + `\n    "componentPath": "./src/wwMyComponent.vue",` + `\n    "editor": {` + `\n        "label": {` + `\n            "en": "My Component",` + `\n            "fr": "Mon Composant"` + `\n        }` + `\n    }` + `\n}`
    );
}
