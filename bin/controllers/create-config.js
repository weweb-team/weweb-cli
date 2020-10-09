#! /usr/bin/env node
const fs = require("fs");

exports.createConfig = () => {
    fs.writeFileSync(
        "./ww-config.json",
        `{` + `\n    "componentPath": "./src/wwMyComponent.vue",` + `\n    "editor": {` + `\n        "label": {` + `\n            "en": "My Component",` + `\n            "fr": "Mon Composant"` + `\n        }` + `\n    }` + `\n}`
    );
};
