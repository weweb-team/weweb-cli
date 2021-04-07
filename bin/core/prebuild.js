#! /usr/bin/env node

const fs = require("fs");

exports.prebuild = (options = {}) => {
    const wwDev = !!options.port;
    const type = options.type || null;
    /*=============================================m_ÔÔ_m=============================================\
        GET AND READ WW-CONFIG
    \================================================================================================*/
    // Get ww-config.json
    if (!fs.existsSync("./ww-config.json")) {
        console.log('\x1b[41mError : "./ww-config.json" was not found.\x1b[0m');
        console.log('\x1b[44mTo create "./ww-config.json" use "weweb create-config".\x1b[0m');
        return false;
    }

    let config = fs.readFileSync("./ww-config.json");

    try {
        config = JSON.parse(config);
    } catch (error) {
        console.log('\x1b[41m Error : unable to parse "./ww-config.json". \x1b[0m');
        return false;
    }

    //Read ww-config.json
    let componentPath = config.componentPath || "./src/wwComponent.vue";
    console.log(`\x1b[44m Component Path : "${componentPath}" \x1b[0m`);

    if (!fs.existsSync(componentPath)) {
        console.log(`\x1b[41m "${componentPath}" not found. Please check "componentPath" in "./ww-config.json". \x1b[0m`);
        return false;
    }

    /*=============================================m_ÔÔ_m=============================================\
        INDEX.JS
    \================================================================================================*/
    //Create index.js
    const tempIndexJs = "./node_modules/@weweb/cli/assets/index.js";
    if (fs.existsSync(tempIndexJs)) {
        fs.unlinkSync(tempIndexJs);
    }

    let indexContent = `import component from '../../../../${componentPath}'

        const name = "__NAME__";
        const version = '__VERSION__';

        const addComponent = function () {
            if (window.vm) {

                const config = ${JSON.stringify(config)};
                if(name.indexOf('__') !== 0){
                    config.name = name;
                }

                config.wwDev = ${wwDev},
                config.port = ${options.port};

                wwLib.wwComponents.register(config);
                
                window.vm.addComponent({
                    name: name,
                    version: version,
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

    fs.writeFileSync(tempIndexJs, indexContent);

    return true;
};
