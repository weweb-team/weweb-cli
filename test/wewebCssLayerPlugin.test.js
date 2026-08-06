const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const webpack = require('webpack');
const createCssLoaders = require('../bin/utils/createCssLoaders');
const rebaseCssUrlsPlugin = require('../bin/utils/rebaseCssUrlsPlugin');
const wewebCssLayerPlugin = require('../bin/utils/wewebCssLayerPlugin');

test('namespaces local, remote, and explicitly layered imports', async () => {
    const result = await postcss([wewebCssLayerPlugin()]).process(
        `
            @charset "UTF-8";
            @import "./local.css";
            @import url("https://example.com/remote.css") layer(theme) supports(display: grid) screen;
            @import "./already-layered.css" layer(ww-style-component.utilities);
            .component { color: red; }
        `,
        { from: 'component.css' }
    );

    assert.match(result.css, /@import "\.\/local\.css" layer\(ww-style-component\);/);
    assert.match(
        result.css,
        /@import url\("https:\/\/example\.com\/remote\.css"\) layer\(ww-style-component\.theme\) supports\(display: grid\) screen;/
    );
    assert.match(
        result.css,
        /@import "\.\/already-layered\.css" layer\(ww-style-component\.utilities\);/
    );
    assert.match(result.css, /@layer ww-style-component\s*\{[\s\S]*\.component \{ color: red; \}[\s\S]*\}/);
    assert.ok(result.css.indexOf('@charset') < result.css.indexOf('@import'));
    assert.ok(result.css.lastIndexOf('@import') < result.css.search(/@layer ww-style-component\s*\{/));
});

test('uses the PostCSS and Sass pipeline for imported CSS', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-css-layer-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'dependency'));

    fs.writeFileSync(path.join(root, 'index.js'), "import './component.css';\n");
    fs.writeFileSync(
        path.join(root, 'component.css'),
        [
            '@import url("https://example.com/remote.css") layer(vendor) screen;',
            '@import "./dependency/dependency.css" layer(theme);',
            '.component { user-select: none; }',
        ].join('\n')
    );
    fs.writeFileSync(
        path.join(root, 'dependency/dependency.css'),
        '.dependency { color: red; background-image: url("./icon.svg"); }\n'
    );
    fs.writeFileSync(path.join(root, 'dependency/icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>\n');

    const loaders = createCssLoaders();
    const cssLoader = loaders.find(loader => typeof loader === 'object' && loader.loader === 'css-loader');
    assert.equal(cssLoader.options.importLoaders, 2);

    await runWebpack({
        mode: 'development',
        entry: path.join(root, 'index.js'),
        output: { path: path.join(root, 'dist'), filename: 'bundle.js', publicPath: '' },
        module: {
            rules: [
                { test: /\.css$/, use: loaders },
                { test: /\.svg$/, type: 'asset/resource' },
            ],
        },
        resolveLoader: { modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'] },
    });

    const bundlePath = path.join(root, 'dist/bundle.js');
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    const emittedCss = executeWebpackBundle(bundlePath);
    assert.match(
        emittedCss,
        /@layer ww-style-component\s*\{[\s\S]*@layer theme\s*\{[\s\S]*\.dependency/
    );
    assert.doesNotMatch(emittedCss, /@layer ww-style-component\s*\{\s*\.dependency/);
    assert.match(bundle, /dependency\/icon\.svg/);
    assert.match(
        emittedCss,
        /@import url\("https:\/\/example\.com\/remote\.css"\) layer\(ww-style-component\.vendor\) screen;/
    );
});

test('rebases imported asset URLs without changing root or external URLs', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-css-urls-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'dependency'));

    fs.writeFileSync(
        path.join(root, 'dependency/dependency.css'),
        [
            '.dependency {',
            '  background-image: url("./icon.svg?v=1#icon");',
            '  mask-image: url("data:image/svg+xml;base64,abc");',
            '  cursor: url("https://example.com/cursor.svg"), auto;',
            '  content: image-set("./image.png" 1x, url("../shared/image.png") 2x);',
            '}',
        ].join('\n')
    );

    const result = await postcss([postcssImport(), rebaseCssUrlsPlugin()]).process(
        '@import "./dependency/dependency.css";\n.root { background: url("./root.svg"); }',
        { from: path.join(root, 'component.css') }
    );

    assert.match(result.css, /url\("\.\/dependency\/icon\.svg\?v=1#icon"\)/);
    assert.match(result.css, /url\("data:image\/svg\+xml;base64,abc"\)/);
    assert.match(result.css, /url\("https:\/\/example\.com\/cursor\.svg"\)/);
    assert.match(result.css, /image-set\("\.\/dependency\/image\.png" 1x, url\("\.\/shared\/image\.png"\) 2x\)/);
    assert.match(result.css, /\.root \{ background: url\("\.\/root\.svg"\); \}/);
});

function runWebpack(config) {
    return new Promise((resolve, reject) => {
        webpack(config, (error, stats) => {
            if (error) return reject(error);
            if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
            resolve();
        });
    });
}

function executeWebpackBundle(bundlePath) {
    const previousDocument = global.document;
    const previousSelf = global.self;
    const styleElements = [];
    const head = {
        appendChild(element) {
            element.parentNode = this;
            styleElements.push(element);
        },
        removeChild(element) {
            const index = styleElements.indexOf(element);
            if (index !== -1) styleElements.splice(index, 1);
        },
    };
    global.document = {
        baseURI: 'https://example.test/',
        head,
        getElementsByTagName: () => [head],
        querySelector: () => null,
        createElement: () => {
            const children = [];
            return {
                children,
                get firstChild() {
                    return children[0];
                },
                appendChild(node) {
                    children.push(node);
                },
                removeChild(node) {
                    const index = children.indexOf(node);
                    if (index !== -1) children.splice(index, 1);
                },
                setAttribute() {},
            };
        },
        createTextNode: textContent => ({ textContent }),
    };
    global.self = { location: { href: global.document.baseURI } };

    try {
        delete require.cache[require.resolve(bundlePath)];
        require(bundlePath);
        return styleElements
            .flatMap(element => element.children)
            .map(node => node.textContent)
            .join('\n');
    } finally {
        global.document = previousDocument;
        global.self = previousSelf;
    }
}
