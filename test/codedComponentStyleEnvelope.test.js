const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const webpack = require('webpack');
const {
    adapterPath,
    createStyleEnvelopeProvidePlugin,
    transformVHtml,
    transformVueTemplateInlineStyles,
    withStyleEnvelopeAdapterEntry,
} = require('../bin/utils/codedComponentStyleEnvelopeWebpack');

test('wraps Vue v-html expressions with the host runtime helper', () => {
    const node = {
        type: 1,
        props: [
            { type: 7, name: 'html', exp: { content: 'source' } },
            { type: 6, name: 'style', value: { content: 'color:red' } },
        ],
    };

    transformVHtml(node);

    assert.equal(node.props[0].exp.content, '$wwCodedStyleEnvelope.html(source)');
    assert.equal(node.props[1].value.content, 'color:red');
});

test('moves Vue static and bound style declarations behind the host runtime helper', () => {
    const source = `<template>
        <div class="root" style="color:red; width: calc(100% - 2px)"></div>
        <span :class="classes" :style="[baseStyle, { backgroundColor: color }]"></span>
        <template v-if="ok"><p v-bind:style="styleObject">Text</p></template>
    </template>
    <script setup>const untouched = '<div style="color:blue">'</script>`;

    const result = transformVueTemplateInlineStyles(source);

    assert.match(
        result,
        /<div class="root ww-coded-inline-style" :style="\$wwCodedStyleEnvelope\.inlineStyle\(&quot;color:red; width: calc\(100% - 2px\)&quot;\)"/
    );
    assert.match(
        result,
        /<span :class="classes" :style="\$wwCodedStyleEnvelope\.inlineStyle\(\[baseStyle, \{ backgroundColor: color \}\]\)" class="ww-coded-inline-style"/
    );
    assert.match(result, /:style="\$wwCodedStyleEnvelope\.inlineStyle\(styleObject\)"/);
    assert.match(result, /const untouched = '<div style="color:blue">'/);
    assert.equal(transformVueTemplateInlineStyles(result), result);
});

test('forwards CSSOM globals to wwLib without embedding the runtime implementation', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-style-envelope-webpack-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const entry = path.join(root, 'entry.js');
    fs.writeFileSync(
        entry,
        'export const create = () => [document.createElement("style"), new CSSStyleSheet(), window.document.head];\n'
    );

    const stats = await runWebpack({
        mode: 'development',
        entry: withStyleEnvelopeAdapterEntry(entry),
        output: { path: path.join(root, 'dist'), filename: 'bundle.js' },
        plugins: [createStyleEnvelopeProvidePlugin(webpack)],
    });
    const modules = stats.toJson({ modules: true }).modules.map(module => module.name);
    const artifact = fs.readFileSync(path.join(root, 'dist/bundle.js'), 'utf8');

    assert.ok(modules.some(name => name.includes('codedComponentStyleEnvelopeAdapter.js')));
    assert.match(artifact, /wwCodedStyleEnvelope/);
    assert.doesNotMatch(artifact, /createCodedComponentStyleEnvelope/);
});

test('the webpack adapter resolves the current host helper lazily', t => {
    const previousWwLib = globalThis.wwLib;
    t.after(() => {
        globalThis.wwLib = previousWwLib;
        delete require.cache[adapterPath];
    });
    const hostDocument = { head: {} };
    const HostCSSStyleSheet = function HostCSSStyleSheet() {};
    globalThis.wwLib = {
        wwCodedStyleEnvelope: { document: hostDocument, CSSStyleSheet: HostCSSStyleSheet },
    };
    delete require.cache[adapterPath];

    const adapter = require(adapterPath);

    assert.equal(adapter.document, hostDocument);
    assert.equal(adapter.CSSStyleSheet, HostCSSStyleSheet);
});

function runWebpack(config) {
    return new Promise((resolve, reject) => {
        webpack(config, (error, stats) => {
            if (error) return reject(error);
            if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
            resolve(stats);
        });
    });
}
