const STYLE_RESET_LAYER = 'ww-style-reset';
const STYLE_CODED_COMPONENT_LAYER = 'ww-style-component';
const STYLE_RUNTIME_LAYER = 'ww-style-runtime';
const STYLE_LAYER_ORDER = [
    STYLE_RESET_LAYER,
    STYLE_CODED_COMPONENT_LAYER,
    'ww-style-library',
    'ww-style-section',
    'ww-style-element',
    STYLE_RUNTIME_LAYER,
];

function wewebCssLayerPlugin(options = {}) {
    const layerName = options.layerName || STYLE_CODED_COMPONENT_LAYER;
    const layerOrder = options.layerOrder || STYLE_LAYER_ORDER;
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

            const layerOrderRule = postcss.atRule({
                name: 'layer',
                params: layerOrder.join(', '),
            });
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
                insertAfter.after(layerOrderRule);
            } else {
                root.prepend(layerOrderRule);
            }
            layerOrderRule.after(layerRule);
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
module.exports.STYLE_RESET_LAYER = STYLE_RESET_LAYER;
module.exports.STYLE_CODED_COMPONENT_LAYER = STYLE_CODED_COMPONENT_LAYER;
module.exports.STYLE_RUNTIME_LAYER = STYLE_RUNTIME_LAYER;
module.exports.STYLE_LAYER_ORDER = STYLE_LAYER_ORDER;
