import component from '../../.././src/wwSection.vue'

        const name = "__NAME__";
        const version = '__VERSION__';

        const addComponent = function () {
            if (window.vm) {

                const config = {"componentPath":"./src/wwSection.vue"};
                if(name.indexOf('__') !== 0){
                    config.name = name;
                }

                wwLib.wwComponents.register(config);
                
                window.vm.addComponent({
                    name: name,
                    version: version,
                    content: component,
                    wwDev: true,
                    port: 8080,
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