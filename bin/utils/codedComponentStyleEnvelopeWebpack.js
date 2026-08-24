const path = require('path');

const adapterPath = path.resolve(__dirname, '../runtime/codedComponentStyleEnvelopeAdapter.js');
const inlineStyleLoaderPath = path.resolve(__dirname, '../loaders/codedComponentInlineStyleLoader.js');
const TEMPLATE_ENVELOPE = '$wwCodedStyleEnvelope';

function withStyleEnvelopeAdapterEntry(entry) {
    if (typeof entry === 'string') return [adapterPath, entry];
    if (Array.isArray(entry)) return entry.includes(adapterPath) ? entry : [adapterPath, ...entry];

    return Object.fromEntries(
        Object.entries(entry).map(([name, value]) => [name, withStyleEnvelopeAdapterEntry(value)])
    );
}

function createStyleEnvelopeProvidePlugin(webpack) {
    return new webpack.ProvidePlugin({
        document: [adapterPath, 'document'],
        CSSStyleSheet: [adapterPath, 'CSSStyleSheet'],
        'window.document': [adapterPath, 'document'],
        'globalThis.document': [adapterPath, 'document'],
        'window.CSSStyleSheet': [adapterPath, 'CSSStyleSheet'],
        'globalThis.CSSStyleSheet': [adapterPath, 'CSSStyleSheet'],
    });
}

function transformVHtml(node) {
    if (node.type !== 1) return;

    for (const property of node.props || []) {
        if (property.type !== 7 || property.name !== 'html' || property.arg || !property.exp) continue;
        const expression = property.exp.content;
        if (!expression || expression.includes(`${TEMPLATE_ENVELOPE}.html(`)) continue;
        property.exp.content = `${TEMPLATE_ENVELOPE}.html(${expression})`;
    }
}

function createVueLoader() {
    return {
        loader: 'vue-loader',
        options: {
            compilerOptions: {
                nodeTransforms: [transformVHtml],
            },
        },
    };
}

function createInlineStyleLoader() {
    return { loader: inlineStyleLoaderPath };
}

function transformVueTemplateInlineStyles(source) {
    if (typeof source !== 'string' || !source) return source;
    const templateStart = source.search(/<template(?:\s|>)/i);
    if (templateStart === -1) return source;
    const openingEnd = findTagEnd(source, templateStart);
    const templateEnd = source.toLowerCase().lastIndexOf('</template>');
    if (openingEnd === -1 || templateEnd < openingEnd) return source;

    const replacements = [];
    let cursor = openingEnd + 1;
    while (cursor < templateEnd) {
        const open = findNextOpeningTag(source, cursor, templateEnd);
        if (!open) break;
        const tag = source.slice(open.start, open.end);
        const attributes = parseAttributeTokens(tag);
        const styles = attributes.filter(
            attribute => attribute.hasValue && ['style', ':style', 'v-bind:style'].includes(attribute.name)
        );
        const expressions = styles.map(style =>
            style.name === 'style' ? JSON.stringify(decodeHtmlAttribute(style.value)) : decodeHtmlAttribute(style.value)
        );
        if (expressions.length) {
            const expression = expressions.length === 1 ? expressions[0] : `[${expressions.join(',')}]`;
            replacements.push({
                start: open.start + styles[0].start,
                end: open.start + styles[0].end,
                value: `v-bind="${escapeHtmlAttribute(`${TEMPLATE_ENVELOPE}.inlineBindings(${expression})`)}"`,
            });
            for (const style of styles.slice(1)) {
                replacements.push({
                    start: open.start + style.start,
                    end: open.start + style.end,
                    value: '',
                });
            }
        }
        cursor = open.end;
        if (isRawTextElement(open.name) && !open.selfClosing) {
            if (open.name === 'plaintext') break;
            const close = source.toLowerCase().indexOf(`</${open.name}`, cursor);
            if (close === -1) break;
            const closeEnd = source.indexOf('>', close);
            cursor = closeEnd === -1 ? templateEnd : closeEnd + 1;
        }
    }
    return applyReplacements(source, replacements);
}

function isRawTextElement(name) {
    return ['style', 'script', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'].includes(name);
}

function findNextOpeningTag(source, from, limit) {
    let cursor = from;
    while (cursor < limit) {
        const start = source.indexOf('<', cursor);
        if (start === -1 || start >= limit) return null;
        if (source.startsWith('<!--', start)) {
            const commentEnd = source.indexOf('-->', start + 4);
            cursor = commentEnd === -1 ? limit : commentEnd + 3;
            continue;
        }
        const match = source.slice(start).match(/^<([a-zA-Z][\w:.-]*)\b/);
        if (!match) {
            cursor = start + 1;
            continue;
        }
        const end = findTagEnd(source, start + match[0].length);
        if (end === -1 || end >= limit) return null;
        return {
            start,
            end: end + 1,
            name: match[1].toLowerCase(),
            selfClosing: /\/\s*>$/.test(source.slice(start, end + 1)),
        };
    }
    return null;
}

function findTagEnd(source, from) {
    let quote = null;
    for (let index = from; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (character === quote) quote = null;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            return index;
        }
    }
    return -1;
}

function parseAttributeTokens(tag) {
    const attributes = [];
    let cursor = tag.search(/\s/);
    if (cursor === -1) return attributes;
    while (cursor < tag.length) {
        while (/\s/.test(tag[cursor])) cursor += 1;
        if (tag[cursor] === '>' || tag[cursor] === '/' || cursor >= tag.length) break;
        const start = cursor;
        while (cursor < tag.length && !/[\s=/>]/.test(tag[cursor])) cursor += 1;
        const name = tag.slice(start, cursor).toLowerCase();
        while (/\s/.test(tag[cursor])) cursor += 1;
        if (tag[cursor] !== '=') {
            attributes.push({ name, start, end: cursor, hasValue: false });
            continue;
        }
        cursor += 1;
        while (/\s/.test(tag[cursor])) cursor += 1;
        const quote = tag[cursor] === '"' || tag[cursor] === "'" ? tag[cursor++] : null;
        const valueStart = cursor;
        if (quote) while (cursor < tag.length && tag[cursor] !== quote) cursor += 1;
        else while (cursor < tag.length && !/[\s>]/.test(tag[cursor])) cursor += 1;
        const valueEnd = cursor;
        if (quote) cursor += 1;
        attributes.push({
            name,
            start,
            end: cursor,
            hasValue: true,
            value: tag.slice(valueStart, valueEnd),
            valueStart,
            valueEnd,
        });
    }
    return attributes;
}

function decodeHtmlAttribute(value) {
    return value
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function applyReplacements(source, replacements) {
    let output = source;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
    }
    return output;
}

module.exports = {
    createStyleEnvelopeProvidePlugin,
    createInlineStyleLoader,
    createVueLoader,
    adapterPath,
    transformVHtml,
    transformVueTemplateInlineStyles,
    withStyleEnvelopeAdapterEntry,
};
