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
    fs.writeFileSync(path.join(root, 'legacy.vue'), '<template><div>Legacy</div></template>');

    const result = spawnSync(
        process.execPath,
        [path.resolve(__dirname, '../bin/weweb.js'), 'build', 'name=wwobject-test', 'type=wwobject'],
        { cwd: root, encoding: 'utf8' }
    );

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /BUILD ERROR/);
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
    fs.writeFileSync(path.join(root, 'src/wwElement.vue'), '<template><div>Valid</div></template>');

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
