
        import component from '../../plugin-airtable/src/index.js'
        import configuration from '../../plugin-airtable/ww-config.js'

        const name = "__NAME__";
        const version = '__VERSION__';

        const config = { ...configuration };
        if (name.indexOf('__') !== 0){
            config.name = name;
        }
        config.wwDev = false,
        config.port = undefined;

        function addComponent() {
            if (window.vm) {
                wwLib.wwComponents.register(config);
                window.vm.addComponent({
                    name,
                    version,
                    content: component,
                    type: 'element',
                    wwDev: false,
                    port: undefined,
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
        }