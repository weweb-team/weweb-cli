const assert = require("node:assert/strict");
const test = require("node:test");

const {
    MigrationGenerationCancelledError,
    addResolution,
    createPrompt,
    generateMigrationInteractively,
    resolveConflict,
    shouldUseInteractiveMode,
} = require("../bin/utils/migrationConflictResolver.js");

const createConflict = (stage, created, deleted, context) => ({
    code: "CONFLICT_NEEDS_RESOLUTION",
    stage,
    conflict: { created, deleted },
    context,
});

test("interactive mode requires TTY input and output unless explicitly disabled", () => {
    const tty = { isTTY: true };
    const pipe = { isTTY: undefined };

    assert.equal(shouldUseInteractiveMode({}, tty, tty), true);
    assert.equal(shouldUseInteractiveMode({}, pipe, tty), false);
    assert.equal(shouldUseInteractiveMode({}, tty, pipe), false);
    assert.equal(shouldUseInteractiveMode({ "non-interactive": true }, tty, tty), false);
    assert.equal(shouldUseInteractiveMode({ "non-interactive": "true" }, tty, tty), false);
    assert.equal(shouldUseInteractiveMode({ "non-interactive": "false" }, tty, tty), true);
});

test("resolves each created item and removes a matched rename candidate", async () => {
    const fullName = { name: "full_name", type: "text" };
    const name = { name: "name", type: "text" };
    const email = { name: "email", type: "text" };
    const conflict = createConflict("columns", [name, email], [fullName], {
        tableName: "users",
        schema: "public",
    });
    const questions = [];
    const prompt = async question => {
        questions.push(question);
        return { decision: question.choices[questions.length === 1 ? 1 : 0].value };
    };

    const { resolution, summary } = await resolveConflict(conflict, prompt);

    assert.deepEqual(resolution.created, [email]);
    assert.deepEqual(resolution.deleted, []);
    assert.deepEqual(resolution.renamed, [{ from: fullName, to: name }]);
    assert.deepEqual(resolution.moved, []);
    assert.equal(questions[0].choices[1].title, 'Renamed from "full_name"');
    assert.equal(questions.length, 1);
    assert.deepEqual(
        summary.map(item => item.type),
        ["rename", "create"]
    );
});

for (const stage of ["enums", "sequences", "tables", "views"]) {
    test(`records ${stage} schema changes as native moves`, async () => {
        const from = { name: "items", schema: "" };
        const to = { name: "items", schema: "archive" };
        const conflict = createConflict(stage, [to], [from]);
        const prompt = async question => {
            assert.equal(question.choices[1].title, 'Moved from "public.items"');
            return { decision: question.choices[1].value };
        };

        const { resolution, summary } = await resolveConflict(conflict, prompt);

        assert.deepEqual(resolution.created, []);
        assert.deepEqual(resolution.deleted, []);
        assert.deepEqual(resolution.renamed, []);
        assert.deepEqual(resolution.moved, [
            {
                name: "items",
                schemaFrom: "",
                schemaTo: "archive",
            },
        ]);
        assert.equal(summary[0].type, "move");
    });
}

const supportedStages = [
    "schemas",
    "enums",
    "sequences",
    "roles",
    "tables",
    "columns",
    "policies",
    "indPolicies",
    "views",
];

for (const stage of supportedStages) {
    test(`builds a safe create-first prompt for ${stage} conflicts`, () => {
        const context = ["columns", "policies"].includes(stage)
            ? { tableName: "users", schema: "public" }
            : undefined;
        const conflict = createConflict(
            stage,
            [{ name: "new_item", schema: "public" }],
            [{ name: "old_item", schema: "public" }],
            context
        );

        const question = createPrompt(conflict, conflict.conflict.created[0], conflict.conflict.deleted, 0);

        assert.equal(question.type, "select");
        assert.equal(question.initial, 0);
        assert.match(question.choices[0].title, /^Create new /);
        assert.equal(question.choices[0].value.type, "create");
        assert.equal(question.choices[1].value.type, "rename");
    });
}

test("stores table-scoped decisions separately from global decisions", () => {
    const decisions = {};
    const resolution = { created: [], deleted: [], renamed: [], moved: [] };

    addResolution(decisions, createConflict("tables", [], []), resolution);
    addResolution(
        decisions,
        createConflict("columns", [], [], { tableName: "users", schema: "public" }),
        resolution
    );
    addResolution(
        decisions,
        createConflict("columns", [], [], { tableName: "teams", schema: "public" }),
        resolution
    );

    assert.equal(decisions.tables, resolution);
    assert.equal(decisions.columns.length, 2);
    assert.equal(decisions.columns[0].tableName, "users");
    assert.equal(decisions.columns[1].tableName, "teams");
});

test("collects successive conflict stages and retries migration generation", async () => {
    const calls = [];
    const logs = [];
    const generateMigration = async (_target, _source, decisions) => {
        calls.push(structuredClone(decisions));
        if (!decisions.schemas) {
            throw createConflict("schemas", [{ name: "app" }], [{ name: "legacy" }]);
        }
        if (!decisions.columns) {
            throw createConflict("columns", [{ name: "name" }], [{ name: "full_name" }], {
                tableName: "users",
                schema: "public",
            });
        }
        return ['ALTER TABLE "users" RENAME COLUMN "full_name" TO "name"'];
    };
    const prompt = async question => ({ decision: question.choices[1].value });

    const migration = await generateMigrationInteractively({
        generateMigration,
        targetSchema: {},
        sourceSchema: {},
        prompt,
        log: message => logs.push(message),
    });

    assert.deepEqual(migration, ['ALTER TABLE "users" RENAME COLUMN "full_name" TO "name"']);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].schemas.renamed.length, 1);
    assert.equal(calls[2].columns[0].renamed.length, 1);
    assert.equal(logs[0], "\nMigration decisions:");
    assert.match(logs[1], /Rename schema/);
    assert.match(logs[2], /Rename column/);
});

test("throws a cancellation error when the prompt is cancelled", async () => {
    const conflict = createConflict("columns", [{ name: "name" }], [{ name: "full_name" }], {
        tableName: "users",
        schema: "public",
    });
    const prompt = async (_question, options) => {
        options.onCancel();
        return {};
    };

    await assert.rejects(resolveConflict(conflict, prompt), error => {
        assert.ok(error instanceof MigrationGenerationCancelledError);
        assert.equal(error.code, "MIGRATION_GENERATION_CANCELLED");
        assert.equal(error.exitCode, 130);
        return true;
    });
});
