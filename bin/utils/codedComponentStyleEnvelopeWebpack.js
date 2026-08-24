const path = require('path');

const runtimePath = path.resolve(__dirname, '../runtime/codedComponentStyleEnvelope.mjs');

function withStyleEnvelopeEntry(entry) {
    if (typeof entry === 'string') return [runtimePath, entry];
    if (Array.isArray(entry)) return entry.includes(runtimePath) ? entry : [runtimePath, ...entry];

    return Object.fromEntries(Object.entries(entry).map(([name, value]) => [name, withStyleEnvelopeEntry(value)]));
}

function createStyleEnvelopeProvidePlugin(webpack) {
    return new webpack.ProvidePlugin({
        document: [runtimePath, 'document'],
        CSSStyleSheet: [runtimePath, 'CSSStyleSheet'],
        'window.document': [runtimePath, 'document'],
        'globalThis.document': [runtimePath, 'document'],
    });
}

function transformVHtml(node) {
    if (node.type !== 1) return;

    for (const property of node.props || []) {
        if (property.type !== 7 || property.name !== 'html' || property.arg || !property.exp) continue;
        const expression = property.exp.content;
        if (!expression || expression.includes('__wwCodedStyleEnvelope.html(')) continue;
        property.exp.content = `globalThis.__wwCodedStyleEnvelope.html(${expression})`;
    }
}

function createVueLoader() {
    return {
        loader: 'vue-loader',
        options: {
            compilerOptions: {
                nodeTransforms: [transformVHtml],
            },
        },
    };
}

module.exports = {
    createStyleEnvelopeProvidePlugin,
    createVueLoader,
    runtimePath,
    transformVHtml,
    withStyleEnvelopeEntry,
};
