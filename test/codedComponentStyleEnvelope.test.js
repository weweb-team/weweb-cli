const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const webpack = require('webpack');
const {
    createStyleEnvelopeProvidePlugin,
    runtimePath,
    transformVHtml,
    transformVueTemplateInlineStyles,
    withStyleEnvelopeEntry,
} = require('../bin/utils/codedComponentStyleEnvelopeWebpack');

test('layers runtime CSS while keeping imports and namespaces at the top level', async () => {
    const { createCodedComponentStyleEnvelope } = await import(runtimePath);
    const diagnostics = [];
    const envelope = createCodedComponentStyleEnvelope({
        globalObject: {},
        report: diagnostic => diagnostics.push(diagnostic),
    });

    const result = envelope.layerCss(
        '@import "theme.css" layer(theme) screen;@namespace svg url(http://www.w3.org/2000/svg);.root{color:red!important}'
    );

    assert.match(result, /^@import "theme\.css" layer\(ww-style-component\.theme\) screen;/);
    assert.match(result, /@namespace svg url\(http:\/\/www\.w3\.org\/2000\/svg\);/);
    assert.match(result, /@layer ww-style-component \{\.root\{color:red!important\}\}/);
    assert.equal(envelope.layerCss(result), result);
    assert.deepEqual(diagnostics, []);
});

test('fails open on invalid CSS and deduplicates diagnostics', async () => {
    const { createCodedComponentStyleEnvelope, STYLE_ENVELOPE_DIAGNOSTICS } = await import(runtimePath);
    const diagnostics = [];
    const envelope = createCodedComponentStyleEnvelope({
        globalObject: {},
        report: diagnostic => diagnostics.push(diagnostic),
    });

    assert.equal(envelope.layerCss('.broken {'), '.broken {');
    assert.equal(envelope.layerCss('.also-broken {'), '.also-broken {');
    assert.deepEqual(diagnostics, [
        { code: STYLE_ENVELOPE_DIAGNOSTICS.PARSE_FAILED, reason: 'unbalanced-css' },
    ]);
});

test('parses comment-heavy imports in linear time', async () => {
    const { createCodedComponentStyleEnvelope } = await import(runtimePath);
    const envelope = createCodedComponentStyleEnvelope({ globalObject: {}, report() {} });
    const comments = '/*x*/'.repeat(10_000);

    const result = envelope.layerCss(`${comments}@import "theme.css";`);

    assert.match(result, /@import "theme\.css" layer\(ww-style-component\);$/);
});

test('transforms style tags and simple stylesheet links in v-html', async () => {
    const { createCodedComponentStyleEnvelope, STYLE_ENVELOPE_DIAGNOSTICS } = await import(runtimePath);
    const diagnostics = [];
    const envelope = createCodedComponentStyleEnvelope({
        globalObject: {},
        report: diagnostic => diagnostics.push(diagnostic),
    });

    const result = envelope.html(
        '<div style="color:red"><style>.child{color:blue}</style><link rel="stylesheet" href="https://cdn.test/theme.css" media="screen"><link rel="stylesheet" href="secure.css" integrity="sha256-test"><script src="https://cdn.test/library.js"></script></div>'
    );

    assert.match(result, /class="ww-coded-inline-style"/);
    assert.match(result, /style="--ww-inline-[^"]+:red"/);
    assert.match(result, /<style>@layer ww-style-component \{\.child\{color:blue\}\}<\/style>/);
    assert.match(
        result,
        /<style data-ww-layered-stylesheet media="screen">@import url\("https:\/\/cdn\.test\/theme\.css"\) layer\(ww-style-component\);<\/style>/
    );
    assert.match(result, /<link rel="stylesheet" href="secure\.css" integrity="sha256-test">/);
    assert.match(result, /<script src="https:\/\/cdn\.test\/library\.js">/);
    assert.deepEqual(
        diagnostics.map(diagnostic => diagnostic.code),
        [STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_STYLESHEET, STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_SCRIPT]
    );
});

test('wraps Vue v-html expressions', () => {
    const node = {
        type: 1,
        props: [
            { type: 7, name: 'html', exp: { content: 'source' } },
            { type: 6, name: 'style', value: { content: 'color:red' } },
        ],
    };

    transformVHtml(node);

    assert.equal(node.props[0].exp.content, 'Object[Symbol.for("ww-coded-style-envelope")].html(source)');
    assert.equal(node.props[1].value.content, 'color:red');
});

test('moves Vue static and bound style declarations behind layered variables', () => {
    const source = `<template>
        <div class="root" style="color:red; width: calc(100% - 2px)"></div>
        <span :class="classes" :style="[baseStyle, { backgroundColor: color }]"></span>
        <template v-if="ok"><p v-bind:style="styleObject">Text</p></template>
    </template>
    <script setup>const untouched = '<div style="color:blue">'</script>`;

    const result = transformVueTemplateInlineStyles(source);

    assert.match(
        result,
        /<div class="root ww-coded-inline-style" :style="Object\[Symbol\.for\(&quot;ww-coded-style-envelope&quot;\)\]\.inlineStyle\(&quot;color:red; width: calc\(100% - 2px\)&quot;\)"/
    );
    assert.match(
        result,
        /<span :class="classes" :style="Object\[Symbol\.for\(&quot;ww-coded-style-envelope&quot;\)\]\.inlineStyle\(\[baseStyle, \{ backgroundColor: color \}\]\)" class="ww-coded-inline-style"/
    );
    assert.match(result, /:style="Object\[Symbol\.for\(&quot;ww-coded-style-envelope&quot;\)\]\.inlineStyle\(styleObject\)"/);
    assert.match(result, /const untouched = '<div style="color:blue">'/);
    assert.equal(transformVueTemplateInlineStyles(result), result);
});

test('normalizes Vue style strings, objects, arrays, fallbacks, removals, and important values', async () => {
    const { createCodedComponentStyleEnvelope } = await import(runtimePath);
    const appended = [];
    const document = {
        head: { appendChild: node => appended.push(node) },
        createElement: () => ({ setAttribute(name) { this[name] = ''; } }),
        querySelector: () => null,
    };
    const envelope = createCodedComponentStyleEnvelope({ globalObject: {}, document, report() {} });

    const result = envelope.inlineStyle([
        'color:blue; --accent: rgb(1, 2, 3)',
        { color: 'red !important', backgroundColor: ['red', 'linear-gradient(black, white)'], width: null },
    ]);

    assert.equal(appended.length, 1);
    assert.equal(Object.values(result).includes('red'), true);
    assert.equal(Object.values(result).includes('rgb(1, 2, 3)'), true);
    assert.equal(Object.values(result).includes('linear-gradient(black, white)'), true);
    assert.equal(Object.values(result).includes(null), false);
    assert.match(appended[0].textContent, /@property --ww-inline-[^{]+\{syntax:"\*";inherits:false;\}/);
    assert.match(appended[0].textContent, /@layer ww-style-component \{\.ww-coded-inline-style\{/);
    assert.match(appended[0].textContent, /color:var\(--ww-inline-[^)]+\)!important;/);
    assert.match(appended[0].textContent, /background-color:var\(--ww-inline-[^)]+\);/);
    assert.match(appended[0].textContent, /--accent:var\(--ww-inline-[^)]+\);/);
});

test('injects the runtime before the component entry and rewrites free browser globals', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-style-envelope-webpack-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const entry = path.join(root, 'entry.js');
    fs.writeFileSync(
        entry,
        'export const create = () => [document.createElement("style"), new CSSStyleSheet(), window.document.head];\n'
    );

    const stats = await runWebpack({
        mode: 'development',
        entry: withStyleEnvelopeEntry(entry),
        output: { path: path.join(root, 'dist'), filename: 'bundle.js' },
        plugins: [createStyleEnvelopeProvidePlugin(webpack)],
    });
    const modules = stats.toJson({ modules: true }).modules.map(module => module.name);

    assert.ok(modules.some(name => name.includes('codedComponentStyleEnvelope.mjs')));
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
