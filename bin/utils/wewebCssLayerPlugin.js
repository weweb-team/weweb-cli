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
                if (isTopLevelImport(node)) {
                    namespaceImportLayer(node, layerName, postcss);
                    return;
                }
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

function namespaceImportLayer(node, layerName, postcss) {
    const params = postcss.list.space(node.params);
    const layerIndex = params.findIndex(param => /^layer(?:\(|$)/i.test(param));

    if (layerIndex === -1) {
        params.splice(1, 0, `layer(${layerName})`);
    } else {
        const importedLayer = getImportedLayerName(params[layerIndex]);
        params[layerIndex] = importedLayer?.startsWith(`${layerName}.`) || importedLayer === layerName
            ? `layer(${importedLayer})`
            : `layer(${importedLayer ? `${layerName}.${importedLayer}` : layerName})`;
    }

    node.params = params.join(' ');
}

function getImportedLayerName(layerParam) {
    if (layerParam.toLowerCase() === 'layer') return '';
    return layerParam.slice(layerParam.indexOf('(') + 1, -1).trim();
}

function isTopLevelImport(node) {
    return node.type === 'atrule' && node.name.toLowerCase() === 'import';
}

function isTopLevelImportBoundary(node) {
    return node.type === 'atrule' && ['charset', 'import'].includes(node.name.toLowerCase());
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
