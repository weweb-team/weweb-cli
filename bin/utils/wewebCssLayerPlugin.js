const STYLE_CODED_COMPONENT_LAYER = 'ww-style-component';

function wewebCssLayerPlugin(options = {}) {
    const layerName = options.layerName || STYLE_CODED_COMPONENT_LAYER;
    const include = options.include;

    return {
        postcssPlugin: 'weweb-css-layer',
        Once(root, { postcss, result }) {
            if (!shouldProcess(result?.opts?.from, include)) return;

            const nodesToWrap = [];
            root.each(node => {
                if (isTopLevelImportBoundary(node)) return;
                nodesToWrap.push(node);
            });

            if (!nodesToWrap.length) return;

            const layerRule = postcss.atRule({
                name: 'layer',
                params: layerName,
            });

            for (const node of nodesToWrap) {
                node.remove();
                layerRule.append(node);
            }

            const insertAfter = getLastTopLevelImportBoundary(root);
            if (insertAfter) {
                insertAfter.after(layerRule);
            } else {
                root.prepend(layerRule);
            }
        },
    };
}

wewebCssLayerPlugin.postcss = true;

function shouldProcess(filePath, include) {
    if (!include) return true;
    if (!filePath) return false;

    if (include instanceof RegExp) return include.test(filePath);
    if (typeof include === 'function') return include(filePath);
    if (Array.isArray(include)) return include.some(entry => shouldProcess(filePath, entry));

    return false;
}

function isTopLevelImportBoundary(node) {
    return node.type === 'atrule' && (node.name === 'charset' || node.name === 'import');
}

function getLastTopLevelImportBoundary(root) {
    let lastBoundary = null;
    root.each(node => {
        if (!isTopLevelImportBoundary(node)) return false;
        lastBoundary = node;
    });

    return lastBoundary;
}

module.exports = wewebCssLayerPlugin;
module.exports.STYLE_CODED_COMPONENT_LAYER = STYLE_CODED_COMPONENT_LAYER;
