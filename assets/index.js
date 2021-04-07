import component from '../../test-react/./src/wwElement.jsx'

        const name = "__NAME__";
        const version = '__VERSION__';

        const addComponent = function () {
            if (window.vm) {

                const config = {"componentPath":"./src/wwElement.jsx","isReact":true,"editor":{"label":{"en":"My Element"},"styleOptions":{"textColor":{"label":{"en":"Text color"},"type":"Color"}}}};
                if(name.indexOf('__') !== 0){
                    config.name = name;
                }

                config.wwDev = true,
                config.port = 4040;

                wwLib.wwComponents.register(config);
                
                window.vm.addComponent({
                    name: name,
                    version: version,
                    content: component,
                    type: 'null',
                    wwDev: true,
                    port: 4040,
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