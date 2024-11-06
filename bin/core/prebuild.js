#! /usr/bin/env node

const fs = require('fs');
const path = require('path');

const PACKAGE_DIRECTORY = process.cwd();
const CONFIG_PATH = path.join(PACKAGE_DIRECTORY, 'ww-config');
const PCK_PATH = path.join(PACKAGE_DIRECTORY, 'package.json');

const getPackageJson = function () {
    try {
        let packageJSON;

        packageJSON = fs.readFileSync(PCK_PATH, 'utf8');
        packageJSON = JSON.parse(packageJSON);

        return packageJSON;
    } catch (error) {
        console.log('\x1b[41mError : ./package.json not found or incorrect format.\x1b[0m', error);
        return null;
    }
};

exports.prebuild = (mode, options = {}) => {
    const TMP_BUILD_DIRECTORY = mode === "build" ? `${PACKAGE_DIRECTORY}/tmp-build` : path.resolve(__dirname, "../../assets");
    const RELATIVE_PATH = path.relative(TMP_BUILD_DIRECTORY, PACKAGE_DIRECTORY);
    const TMP_INDEX_PATH = path.join(TMP_BUILD_DIRECTORY, 'index.js');

    const wwDev = !!options.port;
    const type = options.type || null;

    let fileExtension;
    if (fs.existsSync(`${CONFIG_PATH}.js`)) {
        fileExtension = 'js';
    } else if (fs.existsSync(`${CONFIG_PATH}.json`)) {
        fileExtension = 'json';
    } else {
        console.log('\x1b[41mError : "./ww-config.js(on)" was not found.\x1b[0m');
        console.log('\x1b[44mTo create "./ww-config.js(on)" use "weweb create-config".\x1b[0m');
        return false;
    }

    const packageJSON = getPackageJson();
    if (!packageJSON) {
        console.log('\x1b[41mError : package.json not found\x1b[0m');
        return;
    }

    let componentPath = packageJSON.weweb && packageJSON.weweb.componentPath;
    if (!componentPath) {
        if (fs.existsSync('./src/wwElement.vue')) {
            componentPath = './src/wwElement.vue';
        } else if (fs.existsSync('./src/wwSection.vue')) {
            componentPath = './src/wwSection.vue';
        } else if (fs.existsSync('./src/wwPlugin.js')) {
            componentPath = './src/wwPlugin.js';
        }
    }

    console.log(`\x1b[44m Component Path : "${componentPath}" \x1b[0m`);

    if (!fs.existsSync(componentPath)) {
        console.log(
            `\x1b[41m "${componentPath}" not found. Please check "weweb.componentPath" in "./package.json". \x1b[0m`
        );
        return false;
    }

    if (fs.existsSync(TMP_INDEX_PATH)) {
        fs.unlinkSync(TMP_INDEX_PATH);
    }

    const RELATIVE_COMPONENT_PATH = path.join(RELATIVE_PATH, componentPath).split(path.sep).join(path.posix.sep);
    const RELATIVE_CONFIG_PATH = path
        .join(RELATIVE_PATH, `ww-config.${fileExtension}`)
        .split(path.sep)
        .join(path.posix.sep);

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
            if (window.addWwComponent) {
                window.addWwComponent({
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

    if (!fs.existsSync(TMP_BUILD_DIRECTORY)) {
        fs.mkdirSync(TMP_BUILD_DIRECTORY);
    }

    fs.writeFileSync(TMP_INDEX_PATH, indexContent);

    return true;
};
