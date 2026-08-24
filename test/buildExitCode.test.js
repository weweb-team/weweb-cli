const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('build exits with an error when no component entry can be resolved', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-missing-entry-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'legacy-component', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'ww-config.json'), '{}');

    const result = spawnSync(
        process.execPath,
        [path.resolve(__dirname, '../bin/weweb.js'), 'build', 'name=wwobject-test', 'type=wwobject'],
        { cwd: root, encoding: 'utf8' }
    );

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /BUILD ERROR/);
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('build uses an unambiguous root Vue file as a legacy component entry', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-legacy-entry-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'legacy-component', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'ww-config.json'), '{}');
    fs.writeFileSync(path.join(root, 'legacy.vue'), '<template><div>Legacy</div></template>');

    const result = runBuild(root);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Component Path : "\.\/legacy\.vue"/);
    assert.equal(fs.existsSync(path.join(root, 'dist/manager.js')), true);
});

test('build rejects ambiguous root Vue component entries', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-ambiguous-entry-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'legacy-component', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'ww-config.json'), '{}');
    fs.writeFileSync(path.join(root, 'first.vue'), '<template><div>First</div></template>');
    fs.writeFileSync(path.join(root, 'second.vue'), '<template><div>Second</div></template>');

    const result = runBuild(root);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Multiple root Vue files found/);
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('build exits with an error when webpack rejects the component', (t) => {
    const root = createComponentFixture(t);
    fs.writeFileSync(
        path.join(root, 'src/wwElement.vue'),
        '<template><div><script src="https://example.com/test.js"></script></div></template>'
    );

    const result = runBuild(root);

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /VueCompilerError/);
});

test('build exits successfully after producing the component artifact', (t) => {
    const root = createComponentFixture(t);
    fs.writeFileSync(
        path.join(root, 'src/wwElement.vue'),
        '<template><div><div v-html="source" style="color:red"></div><span :style="dynamicStyle"></span></div></template><script>export default { data: () => ({ source: "<style>.child{color:red}</style>", dynamicStyle: { width: "20px" } }) }</script>'
    );

    const result = runBuild(root);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const artifact = fs.readFileSync(path.join(root, 'dist/manager.js'), 'utf8');
    assert.match(artifact, /wwCodedStyleEnvelope/);
    assert.match(artifact, /WW_CODED_STYLE_ENVELOPE_RUNTIME_REQUIRED/);
    assert.match(artifact, /\.html\(/);
    assert.match(artifact, /\.inlineStyle\(/);
    assert.match(artifact, /ww-coded-inline-style/);
});

test('build ignores optional server-only modules in browser component dependencies', (t) => {
    const root = createComponentFixture(t);
    fs.writeFileSync(
        path.join(root, 'src/wwElement.vue'),
        [
            '<template><div>Browser component</div></template>',
            '<script>',
            "import http2 from 'http2';",
            "import canvas from 'canvas';",
            'export default { data: () => ({ http2, canvas }) };',
            '</script>',
        ].join('\n')
    );

    const result = runBuild(root);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.existsSync(path.join(root, 'dist/manager.js')), true);
});

function createComponentFixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weweb-cli-build-exit-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-component', version: '1.0.0' }));
    fs.writeFileSync(path.join(root, 'ww-config.json'), '{}');
    return root;
}

function runBuild(root) {
    return spawnSync(
        process.execPath,
        [path.resolve(__dirname, '../bin/weweb.js'), 'build', 'name=wwobject-test', 'type=wwobject'],
        { cwd: root, encoding: 'utf8' }
    );
}
