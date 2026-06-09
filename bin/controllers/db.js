const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { introspectPostgres, generateMigration, ConflictNeedsResolutionError, originUUID } = require("@weweb/drizzle-kit/api");

const SCHEMA_FILTERS = ["public", "auth", "storage"];
const USAGE = {
    generate: "Usage: weweb db:generate --source-db-url <url> --target-db-url <url> --output-file <file>",
    execute: "Usage: weweb db:execute --db-url <url> --sql-file <file> [--dry-run]",
};

const createDb = pool => ({
    query: async (sql, params) => {
        const result = await pool.query(sql, params);
        return result.rows;
    },
});

const createInvalidMigrationSqlError = message => {
    const error = new Error(message);
    error.code = "INVALID_SQL_MIGRATION_TEXT";
    return error;
};

const stripLeadingSqlComments = statementText => {
    let normalized = statementText.trim();

    while (normalized) {
        if (normalized.startsWith("--")) {
            const nextLineIndex = normalized.indexOf("\n");
            normalized = nextLineIndex === -1 ? "" : normalized.slice(nextLineIndex + 1).trim();
            continue;
        }

        if (normalized.startsWith("/*")) {
            const blockEndIndex = normalized.indexOf("*/");
            if (blockEndIndex === -1) return normalized;
            normalized = normalized.slice(blockEndIndex + 2).trim();
            continue;
        }

        break;
    }

    return normalized;
};

const splitMigrationStatements = async dbSqlMigrationText => {
    if (typeof dbSqlMigrationText !== "string") {
        throw createInvalidMigrationSqlError("Invalid SQL: expected a string.");
    }

    if (!dbSqlMigrationText.trim()) {
        return [];
    }

    const { parse } = await import("pgsql-parser");

    let parsed;
    try {
        parsed = await parse(dbSqlMigrationText);
    } catch (error) {
        throw createInvalidMigrationSqlError(error.message || "Invalid SQL migration text.");
    }

    const rawStatements = Array.isArray(parsed?.stmts) ? parsed.stmts : [];

    return rawStatements
        .map((rawStatement, index) => {
            const start = Number.isInteger(rawStatement?.stmt_location) ? rawStatement.stmt_location : 0;
            let end = dbSqlMigrationText.length;

            if (Number.isInteger(rawStatement?.stmt_len) && rawStatement.stmt_len > 0) {
                end = start + rawStatement.stmt_len;
            } else if (Number.isInteger(rawStatements[index + 1]?.stmt_location)) {
                end = rawStatements[index + 1].stmt_location;
            }

            return stripLeadingSqlComments(dbSqlMigrationText.slice(start, end)).replace(/;+\s*$/, "").trim();
        })
        .filter(Boolean);
};

const executeStatements = async (connectionString, statements, { dryRun = false } = {}) => {
    const pool = new Pool({ connectionString, max: 1 });
    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        for (const statement of statements) {
            await client.query(statement);
        }

        await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
};

exports.generate = async args => {
    const sourceDbUrl = args["source-db-url"];
    const targetDbUrl = args["target-db-url"];
    const outputFile = args["output-file"];

    if (!sourceDbUrl || !targetDbUrl || !outputFile) {
        console.log(USAGE.generate);
        return 1;
    }

    let sourcePool;
    let targetPool;

    try {
        sourcePool = new Pool({ connectionString: sourceDbUrl, max: 1 });
        targetPool = new Pool({ connectionString: targetDbUrl, max: 1 });

        const sourceSchemaInternal = await introspectPostgres(createDb(sourcePool), () => true, SCHEMA_FILTERS, undefined);
        const targetSchemaInternal = await introspectPostgres(createDb(targetPool), () => true, SCHEMA_FILTERS, undefined);

        const sourceSchema = { id: originUUID, prevId: "", ...sourceSchemaInternal };
        const targetSchema = { id: originUUID, prevId: "", ...targetSchemaInternal };
        const dbSqlMigration = await generateMigration(targetSchema, sourceSchema);
        const sql = dbSqlMigration
            .map(statement => statement.trim())
            .filter(Boolean)
            .map(statement => `${statement.replace(/;+\s*$/, "")};`)
            .join("\n\n");

        await fs.promises.mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
        await fs.promises.writeFile(outputFile, sql ? `${sql}\n` : "", "utf-8");
        console.log(`Migration written to ${outputFile}`);

        return 0;
    } catch (error) {
        if (error instanceof ConflictNeedsResolutionError || error?.code === "CONFLICT_NEEDS_RESOLUTION") {
            console.error(
                JSON.stringify(
                    {
                        type: "decision",
                        conflict: {
                            stage: error.stage,
                            created: error.conflict?.created || [],
                            deleted: error.conflict?.deleted || [],
                            context: error.context,
                        },
                    },
                    null,
                    2
                )
            );
            return 2;
        }

        console.error(error?.message || error);
        return 1;
    } finally {
        if (sourcePool) await sourcePool.end();
        if (targetPool) await targetPool.end();
    }
};

exports.execute = async args => {
    const dbUrl = args["db-url"];
    const sqlFile = args["sql-file"];
    const dryRun = args["dry-run"] === true || args["dry-run"] === "true";

    if (!dbUrl || !sqlFile) {
        console.log(USAGE.execute);
        return 1;
    }

    try {
        const dbSqlMigrationText = await fs.promises.readFile(sqlFile, "utf-8");
        const statements = await splitMigrationStatements(dbSqlMigrationText);

        if (statements.length === 0) {
            console.log("No migration statements to execute.");
            return 0;
        }

        await executeStatements(dbUrl, statements, { dryRun });
        console.log(dryRun ? "Migration dry-run completed successfully." : "Migration executed successfully.");

        return 0;
    } catch (error) {
        console.error(error?.message || error);
        return 1;
    }
};
