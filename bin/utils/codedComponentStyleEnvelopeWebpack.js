const path = require('path');

const adapterPath = path.resolve(__dirname, '../runtime/codedComponentStyleEnvelopeAdapter.js');
const TEMPLATE_ENVELOPE = '$wwCodedStyleEnvelope';

function withStyleEnvelopeAdapterEntry(entry) {
    if (typeof entry === 'string') return [adapterPath, entry];
    if (Array.isArray(entry)) return entry.includes(adapterPath) ? entry : [adapterPath, ...entry];

    return Object.fromEntries(
        Object.entries(entry).map(([name, value]) => [name, withStyleEnvelopeAdapterEntry(value)])
    );
}

function createStyleEnvelopeProvidePlugin(webpack) {
    return new webpack.ProvidePlugin({
        document: [adapterPath, 'document'],
        CSSStyleSheet: [adapterPath, 'CSSStyleSheet'],
        'window.document': [adapterPath, 'document'],
        'globalThis.document': [adapterPath, 'document'],
        'window.CSSStyleSheet': [adapterPath, 'CSSStyleSheet'],
        'globalThis.CSSStyleSheet': [adapterPath, 'CSSStyleSheet'],
    });
}

function transformVueTemplateNode(node) {
    if (node.type !== 1 || node.tagType !== 0) return;

    for (const property of node.props || []) {
        if (property.type !== 7) continue;
        if (property.name === 'html' && !property.arg && property.exp) {
            property.exp = createRuntimeExpression('html', property.exp);
            continue;
        }
        if (property.name !== 'bind') continue;
        if (!property.arg && property.exp) {
            property.exp = createRuntimeExpression('inlineProps', property.exp);
            continue;
        }
        if (!isStaticStyleArgument(property.arg)) continue;

        property.arg = undefined;
        property.exp = createRuntimeExpression('inlineBindings', property.exp || createContextExpression('style'));
    }
}

function isStaticStyleArgument(argument) {
    return argument?.type === 4 && argument.isStatic && argument.content === 'style';
}

function createRuntimeExpression(method, expression) {
    return {
        type: 8,
        loc: expression.loc,
        children: [`_ctx.${TEMPLATE_ENVELOPE}.${method}(`, expression, ')'],
    };
}

function createContextExpression(property) {
    return {
        type: 4,
        loc: { source: property, start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        content: `_ctx.${property}`,
        isStatic: false,
        constType: 0,
    };
}

function createVueLoader() {
    return {
        loader: 'vue-loader',
        options: {
            compilerOptions: {
                nodeTransforms: [transformVueTemplateNode],
            },
        },
    };
}

module.exports = {
    createStyleEnvelopeProvidePlugin,
    createVueLoader,
    adapterPath,
    transformVueTemplateNode,
    withStyleEnvelopeAdapterEntry,
};
