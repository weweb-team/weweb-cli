const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { compile } = require('@vue/compiler-dom');
const webpack = require('webpack');
const {
    adapterPath,
    createStyleEnvelopeProvidePlugin,
    createVueLoader,
    withStyleEnvelopeAdapterEntry,
} = require('../bin/utils/codedComponentStyleEnvelopeWebpack');

test('wraps Vue v-html expressions with the host runtime helper', () => {
    const result = compileTemplate('<div v-html="source"></div>');

    assert.match(result, /innerHTML: _ctx\.\$wwCodedStyleEnvelope\.html\(_ctx\.source\)/);
});

test('moves Vue style declarations behind the host runtime helper in compiler order', () => {
    const source = `
        <div class="root" style="color:red; width: calc(100% - 2px)"></div>
        <span :class="classes" :style="[baseStyle, { backgroundColor: color }]"></span>
        <template v-if="ok"><p v-bind:style="styleObject">Text</p></template>
    `;

    const result = compileTemplate(source);

    assert.match(
        result,
        /_ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(\{"color":"red","width":"calc\(100% - 2px\)"\}\)/
    );
    assert.match(
        result,
        /_ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(\[_ctx\.baseStyle, \{ backgroundColor: _ctx\.color \}\]\)/
    );
    assert.match(result, /_ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(_ctx\.styleObject\)/);
});

test('preserves spread-binding order while moving every style declaration', () => {
    const source = '<div style="color:red" v-bind="attrs" :style="dynamicStyle"></div>';

    const result = compileTemplate(source);

    assert.match(
        result,
        /_mergeProps\(_ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(\{"color":"red"\}\), _ctx\.\$wwCodedStyleEnvelope\.inlineProps\(_ctx\.attrs\), _ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(_ctx\.dynamicStyle\)\)/
    );
});

test('moves style declarations from native Vue v-bind objects behind layered variables', () => {
    const result = compileTemplate(
        '<div v-bind="attrs"></div><span v-bind="{ style: dynamicStyle, class: classes }"></span>'
    );

    assert.match(result, /_ctx\.\$wwCodedStyleEnvelope\.inlineProps\(_ctx\.attrs\)/);
    assert.match(
        result,
        /_ctx\.\$wwCodedStyleEnvelope\.inlineProps\(\{ style: _ctx\.dynamicStyle, class: _ctx\.classes \}\)/
    );
});

test('preserves style props on Vue components while transforming native elements', () => {
    const result = compileTemplate('<Widget :style="configuration" v-bind="props"/><div :style="configuration"/>');

    assert.match(result, /style: _ctx\.configuration/);
    assert.match(result, /_ctx\.props/);
    assert.equal((result.match(/\$wwCodedStyleEnvelope\.inlineBindings\(/g) || []).length, 1);
    assert.doesNotMatch(result, /inlineProps\(_ctx\.props\)/);
});

test('defers dynamic component style handling to the resolved runtime type', () => {
    const result = compileTemplate(
        '<component :is="tag" v-html="html" :style="style" v-bind="props"/>'
    );
    const staticResult = compileTemplate('<component is="div" :style="style"/>');

    assert.match(result, /\$wwCodedStyleEnvelope\.dynamic\(_ctx\.tag\)\.html\(_ctx\.html\)/);
    assert.match(result, /\$wwCodedStyleEnvelope\.dynamic\(_ctx\.tag\)\.inlineBindings\(_ctx\.style\)/);
    assert.match(result, /\$wwCodedStyleEnvelope\.dynamic\(_ctx\.tag\)\.inlineProps\(_ctx\.props\)/);
    assert.match(staticResult, /\$wwCodedStyleEnvelope\.dynamic\("div"\)\.inlineBindings\(_ctx\.style\)/);
});

test('supports Vue same-name style shorthand', () => {
    const result = compileTemplate('<div :style></div>');

    assert.match(result, /_ctx\.\$wwCodedStyleEnvelope\.inlineBindings\(_ctx\.style\)/);
});

test('does not rewrite markup-like text after raw-text closing-tag prefixes', () => {
    const result = compileTemplate(
        '<textarea></textarea-fake><span style="color:red"></span></textarea><div style="color:blue"></div>'
    );

    assert.match(result, /"<\/textarea-fake><span style=\\"color:red\\"><\/span>"/);
    assert.equal((result.match(/\$wwCodedStyleEnvelope\.inlineBindings\(/g) || []).length, 1);
});

test('forwards CSSOM globals to wwLib without embedding the runtime implementation', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-style-envelope-webpack-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const entry = path.join(root, 'entry.js');
    fs.writeFileSync(
        entry,
        'export const create = () => [document.createElement("style"), new CSSStyleSheet(), window.document.head, window.CSSStyleSheet, globalThis.CSSStyleSheet];\n'
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
    assert.doesNotMatch(artifact, /window\.CSSStyleSheet/);
    assert.doesNotMatch(artifact, /globalThis\.CSSStyleSheet/);
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
        wwCodedStyleEnvelope: {
            document: hostDocument,
            CSSStyleSheet: HostCSSStyleSheet,
        },
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

function compileTemplate(source) {
    return compile(source, {
        mode: 'module',
        nodeTransforms: createVueLoader().options.compilerOptions.nodeTransforms,
    }).code;
}
