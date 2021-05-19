#! /usr/bin/env node

const fs = require("fs");
const path = require("path");

const PACKAGE_DIRECTORY = process.cwd();
const ASSETS_DIRECTORY = path.resolve(__dirname, '../../assets');
const RELATIVE_PATH = path.relative(ASSETS_DIRECTORY, PACKAGE_DIRECTORY);

const CONFIG_PATH = path.join(PACKAGE_DIRECTORY, 'ww-config');
const TMP_INDEX_PATH = path.join(ASSETS_DIRECTORY, 'index.js');

console.log({PACKAGE_DIRECTORY, ASSETS_DIRECTORY, CONFIG_PATH, TMP_INDEX_PATH, RELATIVE_PATH});

exports.prebuild = (options = {}) => {
    const wwDev = !!options.port;
    const type = options.type || null;

    let fileExtension
    if (fs.existsSync(`${CONFIG_PATH}.js`)) {
        fileExtension = 'js'
    } else if (fs.existsSync(`${CONFIG_PATH}.json`)) {
        fileExtension = 'json'
    } else {
        console.log('\x1b[41mError : "./ww-config.js(on)" was not found.\x1b[0m');
        console.log('\x1b[44mTo create "./ww-config.js(on)" use "weweb create-config".\x1b[0m');
        return false;
    }

    const config = require(CONFIG_PATH);

    let componentPath = config.componentPath || "./src/wwComponent.vue";
    console.log(`\x1b[44m Component Path : "${componentPath}" \x1b[0m`);

    if (!fs.existsSync(componentPath)) {
        console.log(
            `\x1b[41m "${componentPath}" not found. Please check "componentPath" in "./ww-config.json". \x1b[0m`
        );
        return false;
    }

    if (fs.existsSync(TMP_INDEX_PATH)) {
        fs.unlinkSync(TMP_INDEX_PATH);
    }


    const RELATIVE_COMPONENT_PATH = path.join(RELATIVE_PATH, componentPath).split(path.sep).join(path.posix.sep);;
    const RELATIVE_CONFIG_PATH = path.join(RELATIVE_PATH, `ww-config.${fileExtension}`).split(path.sep).join(path.posix.sep);

    console.log({RELATIVE_COMPONENT_PATH, RELATIVE_CONFIG_PATH})

    let indexContent = `
        import component from '${RELATIVE_COMPONENT_PATH}'
        import configuration from '${RELATIVE_CONFIG_PATH}'

        const name = "__NAME__";
        const version = '__VERSION__';

        const config = { ...configuration };
        if (name.indexOf('__') !== 0){
            config.name = name;
        }
        config.wwDev = ${wwDev},
        config.port = ${options.port};

        function addComponent() {
            if (window.vm) {
                wwLib.wwComponents.register(config);
                window.vm.addComponent({
                    name,
                    version,
                    content: component,
                    type: '${type}',
                    wwDev: ${wwDev},
                    port: ${options.port},
                    config,
                });
                return true;
            }
            return false;
        }

        if (!addComponent()) {
            const iniInterval = setInterval(function () {
                if (addComponent()) {
                    clearInterval(iniInterval);
                }
            }, 10);
        }`;

    fs.writeFileSync(TMP_INDEX_PATH, indexContent);

    return true;
};
