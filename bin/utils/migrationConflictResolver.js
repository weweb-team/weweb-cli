const prompts = require("prompts");

const ENTITY_TYPES = {
    schemas: "schema",
    enums: "enum",
    sequences: "sequence",
    roles: "role",
    tables: "table",
    columns: "column",
    policies: "policy",
    indPolicies: "policy",
    views: "view",
};
const MOVABLE_STAGES = new Set(["enums", "sequences", "tables", "views"]);
const TABLE_SCOPED_STAGES = new Set(["columns", "policies"]);

class MigrationGenerationCancelledError extends Error {
    constructor() {
        super("Migration generation cancelled.");
        this.code = "MIGRATION_GENERATION_CANCELLED";
        this.exitCode = 130;
    }
}

const isConflictResolutionError = error =>
    error?.code === "CONFLICT_NEEDS_RESOLUTION" &&
    typeof error.stage === "string" &&
    Array.isArray(error.conflict?.created) &&
    Array.isArray(error.conflict?.deleted);

const getEntityType = stage => ENTITY_TYPES[stage] || "item";

const getQualifiedName = (item, stage) => {
    if (MOVABLE_STAGES.has(stage)) return `${item.schema || "public"}.${item.name}`;
    return `${item.schema ? `${item.schema}.` : ""}${item.name}`;
};

const formatItemName = (item, context, stage) => (context?.tableName ? item.name : getQualifiedName(item, stage));

const isMove = (stage, deletedItem, createdItem) =>
    MOVABLE_STAGES.has(stage) &&
    deletedItem.name === createdItem.name &&
    (deletedItem.schema || "public") !== (createdItem.schema || "public");

const createPrompt = (error, createdItem, deletedItems, itemIndex) => {
    const { stage, context } = error;
    const entityType = getEntityType(stage);
    const itemName = formatItemName(createdItem, context, stage);
    const location = context?.tableName ? ` in table "${context.tableName}"` : "";
    const deletedNames = deletedItems.map(item => `"${formatItemName(item, context, stage)}"`).join(", ");
    const includesMove = deletedItems.some(item => isMove(stage, item, createdItem));
    const candidates = deletedItems.map(deletedItem => {
        const deletedName = formatItemName(deletedItem, context, stage);
        const moved = isMove(stage, deletedItem, createdItem);

        return {
            title: moved ? `Moved from "${deletedName}"` : `Renamed from "${deletedName}"`,
            description: moved
                ? `"${deletedName}" was moved to "${itemName}" (preserves data)`
                : `"${deletedName}" was renamed to "${itemName}" (preserves data)`,
            value: { type: moved ? "move" : "rename", from: deletedItem, to: createdItem },
        };
    });

    return {
        type: "select",
        name: "decision",
        message: `Is "${itemName}" a new ${entityType}${location}, or was it ${
            includesMove ? "moved or renamed" : "renamed"
        } from one of these: ${deletedNames}? (${itemIndex + 1}/${error.conflict.created.length})`,
        initial: 0,
        hint: "- Use arrow keys. Return to submit.",
        choices: [
            {
                title: `Create new ${entityType}`,
                description: `"${itemName}" is a new ${entityType}`,
                value: { type: "create", item: createdItem },
            },
            ...candidates,
        ],
    };
};

const resolveConflict = async (error, prompt = prompts) => {
    const remainingDeleted = [...error.conflict.deleted];
    const resolution = { created: [], deleted: remainingDeleted, renamed: [], moved: [] };
    const summary = [];

    for (let index = 0; index < error.conflict.created.length; index++) {
        const createdItem = error.conflict.created[index];

        if (remainingDeleted.length === 0) {
            resolution.created.push(createdItem);
            summary.push({
                type: "create",
                stage: error.stage,
                context: error.context,
                to: createdItem,
            });
            continue;
        }

        let cancelled = false;
        const response = await prompt(createPrompt(error, createdItem, remainingDeleted, index), {
            onCancel: () => {
                cancelled = true;
                return false;
            },
        });

        if (cancelled || !Object.hasOwn(response, "decision")) {
            throw new MigrationGenerationCancelledError();
        }

        const decision = response.decision;
        if (decision.type === "create") {
            resolution.created.push(decision.item);
            summary.push({
                type: "create",
                stage: error.stage,
                context: error.context,
                to: decision.item,
            });
            continue;
        }

        const deletedIndex = remainingDeleted.indexOf(decision.from);
        if (deletedIndex === -1) {
            throw new Error(`The selected ${getEntityType(error.stage)} was already matched.`);
        }
        remainingDeleted.splice(deletedIndex, 1);

        if (decision.type === "move") {
            resolution.moved.push({
                name: decision.to.name,
                schemaFrom: decision.from.schema,
                schemaTo: decision.to.schema,
            });
        } else {
            resolution.renamed.push({ from: decision.from, to: decision.to });
        }

        summary.push({
            type: decision.type,
            stage: error.stage,
            context: error.context,
            from: decision.from,
            to: decision.to,
        });
    }

    for (const deletedItem of remainingDeleted) {
        summary.push({
            type: "delete",
            stage: error.stage,
            context: error.context,
            from: deletedItem,
        });
    }

    return { resolution, summary };
};

const addResolution = (decisions, error, resolution) => {
    if (TABLE_SCOPED_STAGES.has(error.stage)) {
        decisions[error.stage] ||= [];
        decisions[error.stage].push({
            tableName: error.context?.tableName,
            schema: error.context?.schema,
            ...resolution,
        });
        return;
    }

    decisions[error.stage] = resolution;
};

const formatSummaryLine = item => {
    const entityType = getEntityType(item.stage);
    const context = item.context?.tableName
        ? ` ${entityType} in ${item.context.schema ? `${item.context.schema}.` : ""}${item.context.tableName}`
        : ` ${entityType}`;

    if (item.type === "create") {
        return `  Create${context} "${formatItemName(item.to, item.context, item.stage)}"`;
    }
    if (item.type === "delete") {
        return `  Delete${context} "${formatItemName(item.from, item.context, item.stage)}"`;
    }

    const action = item.type === "move" ? "Move" : "Rename";
    const from = formatItemName(item.from, item.context, item.stage);
    const to = formatItemName(item.to, item.context, item.stage);
    return `  ${action}${context} "${from}" -> "${to}"`;
};

const printSummary = (summary, log = console.log) => {
    if (summary.length === 0) return;

    log("\nMigration decisions:");
    for (const item of summary) log(formatSummaryLine(item));
    log("");
};

const generateMigrationInteractively = async ({
    generateMigration,
    targetSchema,
    sourceSchema,
    prompt = prompts,
    log = console.log,
}) => {
    const decisions = {};
    const summary = [];

    while (true) {
        try {
            const migration = await generateMigration(targetSchema, sourceSchema, decisions);
            printSummary(summary, log);
            return migration;
        } catch (error) {
            if (!isConflictResolutionError(error)) throw error;

            const result = await resolveConflict(error, prompt);
            addResolution(decisions, error, result.resolution);
            summary.push(...result.summary);
        }
    }
};

const shouldUseInteractiveMode = (args, input = process.stdin, output = process.stdout) => {
    const nonInteractive = args["non-interactive"] === true || args["non-interactive"] === "true";
    return !nonInteractive && input.isTTY === true && output.isTTY === true;
};

module.exports = {
    MigrationGenerationCancelledError,
    addResolution,
    createPrompt,
    formatSummaryLine,
    generateMigrationInteractively,
    isConflictResolutionError,
    resolveConflict,
    shouldUseInteractiveMode,
};
