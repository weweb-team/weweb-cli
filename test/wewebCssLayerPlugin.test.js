const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const postcss = require('postcss');
const webpack = require('webpack');
const createCssLoaders = require('../bin/utils/createCssLoaders');
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

    fs.writeFileSync(path.join(root, 'index.js'), "import './component.css';\n");
    fs.writeFileSync(
        path.join(root, 'component.css'),
        '@import "./dependency.css" layer(theme);\n.component { user-select: none; }\n'
    );
    fs.writeFileSync(path.join(root, 'dependency.css'), '.dependency { color: red; }\n');

    const loaders = createCssLoaders();
    const cssLoader = loaders.find(loader => typeof loader === 'object' && loader.loader === 'css-loader');
    assert.equal(cssLoader.options.importLoaders, 2);

    await runWebpack({
        mode: 'development',
        entry: path.join(root, 'index.js'),
        output: { path: path.join(root, 'dist'), filename: 'bundle.js' },
        module: { rules: [{ test: /\.css$/, use: loaders }] },
        resolveLoader: { modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'] },
    });

    const bundle = fs.readFileSync(path.join(root, 'dist/bundle.js'), 'utf8');
    assert.match(bundle, /ww-style-component\.theme/);
    assert.match(bundle, /dependency/);
    assert.match(bundle, /ww-style-component/);
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
