const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const aiApi = require("../utils/ai-api.js");
const output = require("../utils/output.js");

const ELEMENT_DOCS_DIR = path.resolve(__dirname, "..", "..", "element-docs");

function parseJson(str, what = "--data") {
    if (!str) return null;
    try {
        return JSON.parse(str);
    } catch {
        throw Object.assign(new Error(`Invalid JSON in ${what}`), { status: 400, code: "BAD_JSON" });
    }
}

function exitMissing(flag) {
    return Object.assign(new Error(`--${flag} is required`), { status: 400, code: `MISSING_${flag.replace(/-/g, "_").toUpperCase()}` });
}

function parseValue(v) {
    if (v === undefined) return undefined;
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.startsWith("{") || v.startsWith("[")) {
        try { return JSON.parse(v); } catch { /* fall through */ }
    }
    return v;
}

/**
 * Recursively fill missing `uid` fields on every element subtree with a fresh UUID.
 * Preserves caller-provided uids (real UUIDs or ❖fake❖ placeholders the server resolves).
 * Walks any nested children/wwObjects arrays and any other array-of-element slots
 * we can recognize by the presence of a `tag` field.
 */
function fillMissingUids(elements) {
    if (!Array.isArray(elements)) return;
    for (const el of elements) {
        if (!el || typeof el !== "object") continue;
        if (!el.uid) el.uid = crypto.randomUUID();
        const slots = el.content?.default;
        if (slots && typeof slots === "object") {
            for (const slotValue of Object.values(slots)) {
                if (Array.isArray(slotValue) && slotValue.some(item => item && item.tag)) {
                    fillMissingUids(slotValue);
                }
            }
        }
    }
}

/**
 * weweb elements list --page-id=<id> [--uids=a,b,c]
 *
 * NB: by design, the underlying /page-elements endpoint returns wwObjects
 * (children of sections) only — NOT sections themselves. To see a section,
 * pass its uid via --uids=<sectionUid>. Or use `weweb pages get <pageId>`
 * for the full markdown semantic including sections.
 */
async function list(options) {
    if (!options.pageId) throw exitMissing("page-id");
    await aiApi.run(async () => {
        const body = {
            pageId: options.pageId,
            uids: options.uids ? options.uids.split(",").map(s => s.trim()) : undefined,
        };
        const data = await aiApi.post(options, "/page-elements", body);
        if (output.getJsonMode()) output.json({ status: "ok", data });
        else process.stdout.write(JSON.stringify(data?.elements || data, null, 2) + "\n");
    });
}

/**
 * weweb elements describe <tag>
 *
 * Reads bundled element-docs/<tag>.json (synced from weweb-ai). Pure local
 * file read — no network. Returns the element's full documentation: metadata,
 * properties, slots, states, events, specifications, examples.
 */
async function describe(tag, _options) {
    if (!tag) throw exitMissing("tag");
    const file = path.join(ELEMENT_DOCS_DIR, `${tag}.json`);
    if (!fs.existsSync(file)) {
        const known = fs.existsSync(ELEMENT_DOCS_DIR)
            ? fs.readdirSync(ELEMENT_DOCS_DIR).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""))
            : [];
        const err = Object.assign(
            new Error(`Unknown element tag: ${tag}.${known.length ? `\nKnown: ${known.join(", ")}` : ""}`),
            { status: 404, code: "UNKNOWN_ELEMENT_TAG" }
        );
        return aiApi.run(async () => { throw err; });
    }
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    if (output.getJsonMode()) output.json({ status: "ok", data: doc });
    else process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
}

/**
 * weweb elements add --page-id=<id> --parent-id=<id> [--slot=children] [--previous-id=<id>] --data '[{tag,content,...},...]'
 *
 * Body: { action: 'add', params: { parentId, slotKey, previousElementId }, elements: [...], userSession: { pageId } }
 *
 * The `elements` array uses the API's element shape:
 *   { tag, name?, content: { default: { _ww-<tag>_<prop>: …, children: [...] } } }
 * See the `weweb-element-types` skill for the prefix rule and propertyMappings table.
 */
async function add(options) {
    if (!options.pageId) throw exitMissing("page-id");
    // parent-id is optional: omit it (or pass --parent-id "") to add top-level ww-section(s)
    // directly on the page (the back's findParentAndChildren treats no parentId as parentType='page').
    const elements = parseJson(options.data, "--data");
    if (!Array.isArray(elements)) throw Object.assign(new Error("--data must be an array of elements"), { status: 400, code: "BAD_JSON" });
    fillMissingUids(elements);
    await aiApi.run(async () => {
        const body = {
            action: "add",
            params: {
                parentId: options.parentId,
                slotKey: options.slot || "children",
                previousElementId: options.previousId,
            },
            elements,
            userSession: { pageId: options.pageId },
        };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit("Elements added", data);
    });
}

/**
 * weweb elements edit <uid> --page-id=<id> --path=content.default._ww-text_fontSize --value=24px
 *
 * Single edit only. To make multiple edits, run the command multiple times.
 * The path is a dot-notation path INTO the element JSON (after the element
 * doc has been fetched), and value can be string/number/bool/null/JSON.
 */
async function edit(uid, options) {
    if (!options.pageId) throw exitMissing("page-id");
    if (!options.path) throw exitMissing("path");
    await aiApi.run(async () => {
        const body = {
            action: "edit",
            params: { elementId: uid, path: options.path, value: parseValue(options.value) },
            userSession: { pageId: options.pageId },
        };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit("Element edited", data);
    });
}

/**
 * weweb elements delete <uid> --page-id=<id> [--parent-id=<id>]
 *
 * `--parent-id` is the parent of the element being deleted. The API uses it
 * to update the parent's children/wwObjects array.
 */
async function del(uid, options) {
    if (!options.pageId) throw exitMissing("page-id");
    await aiApi.run(async () => {
        const body = {
            action: "delete",
            params: { elementId: uid, parentId: options.parentId },
            userSession: { pageId: options.pageId },
        };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit("Element deleted", data);
    });
}

/**
 * weweb elements move <uid> --page-id=<id> --old-parent-id=<id> --new-parent-id=<id> [--slot=children] [--previous-id=<id>]
 */
async function move(uid, options) {
    if (!options.pageId) throw exitMissing("page-id");
    if (!options.oldParentId) throw exitMissing("old-parent-id");
    if (!options.newParentId) throw exitMissing("new-parent-id");
    await aiApi.run(async () => {
        const body = {
            action: "move",
            params: {
                elementId: uid,
                oldParentId: options.oldParentId,
                newParentId: options.newParentId,
                slotKey: options.slot || "children",
                previousElementId: options.previousId,
            },
            userSession: { pageId: options.pageId },
        };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit("Element moved", data);
    });
}

/**
 * weweb elements replace <uid> --page-id=<id> --data '[{tag,content,...},...]'
 *
 * Same shape as `add`. The element identified by <uid> is replaced in-place
 * by the elements in --data (single-element arrays are typical; multiple
 * elements replace it as siblings).
 */
async function replace(uid, options) {
    if (!options.pageId) throw exitMissing("page-id");
    const elements = parseJson(options.data, "--data");
    if (!Array.isArray(elements)) throw Object.assign(new Error("--data must be an array of elements"), { status: 400, code: "BAD_JSON" });
    fillMissingUids(elements);
    await aiApi.run(async () => {
        const body = {
            action: "replace",
            params: { elementId: uid },
            elements,
            userSession: { pageId: options.pageId },
        };
        const data = await aiApi.post(options, "/save", body);
        aiApi.emit("Element replaced", data);
    });
}

module.exports = { list, describe, add, edit, delete: del, move, replace };
