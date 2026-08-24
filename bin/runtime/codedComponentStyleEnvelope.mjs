// This browser runtime is also shipped by weweb-editor for extracted Vite fronts. Keep both copies identical.
const DEFAULT_LAYER = 'ww-style-component';
const INLINE_STYLE_CLASS = 'ww-coded-inline-style';
const TEMPLATE_ENVELOPE_SYMBOL = Symbol.for('ww-coded-style-envelope');

export const STYLE_ENVELOPE_DIAGNOSTICS = Object.freeze({
    PARSE_FAILED: 'WW_STYLE_ENVELOPE_PARSE_FAILED',
    EXTERNAL_STYLESHEET: 'WW_STYLE_ENVELOPE_EXTERNAL_STYLESHEET',
    EXTERNAL_SCRIPT: 'WW_STYLE_ENVELOPE_EXTERNAL_SCRIPT',
    CSSOM_TOPOLOGY: 'WW_STYLE_ENVELOPE_CSSOM_TOPOLOGY_UNSUPPORTED',
});

export function createCodedComponentStyleEnvelope(options = {}) {
    const globalObject = options.globalObject || globalThis;
    const nativeDocument = options.document || globalObject.document;
    const NativeCSSStyleSheet = options.CSSStyleSheet || globalObject.CSSStyleSheet;
    const layerName = options.layerName || DEFAULT_LAYER;
    const reportedDiagnostics = new Set();
    const patchedSheets = new WeakSet();
    const decoratedStyles = new WeakSet();
    const containerProxies = new WeakMap();
    const inlineDeclarations = new Map();
    const inlineProperties = new Set();
    let inlineRegistryStyle;

    const report = (code, details = {}) => {
        const key = `${code}:${details.reason || ''}`;
        if (reportedDiagnostics.has(key)) return;
        reportedDiagnostics.add(key);

        if (options.report) {
            options.report({ code, ...details });
            return;
        }
        globalObject.console?.warn?.(`[WeWeb] ${code}`, details);
    };

    const layerCss = css => {
        if (typeof css !== 'string' || !css.trim()) return css;

        const rules = splitTopLevelRules(css);
        if (!rules) {
            report(STYLE_ENVELOPE_DIAGNOSTICS.PARSE_FAILED, { reason: 'unbalanced-css' });
            return css;
        }

        const boundaries = [];
        const alreadyLayered = [];
        const rulesToLayer = [];
        for (const rule of rules) {
            const atRuleName = getAtRuleName(rule);
            if (atRuleName === 'import') {
                boundaries.push(namespaceImportLayer(rule, layerName));
            } else if (atRuleName === 'charset' || atRuleName === 'namespace') {
                boundaries.push(rule);
            } else if (isExactLayerRule(rule, layerName)) {
                alreadyLayered.push(rule);
            } else {
                rulesToLayer.push(rule);
            }
        }

        const output = [...boundaries, ...alreadyLayered];
        if (rulesToLayer.some(rule => rule.trim())) {
            output.push(`@layer ${layerName} {${rulesToLayer.join('')}}`);
        }
        return output.join('');
    };

    const renderInlineStyleRegistry = () => {
        if (!nativeDocument?.head || !inlineDeclarations.size) return;
        if (!inlineRegistryStyle) {
            inlineRegistryStyle = nativeDocument.createElement('style');
            inlineRegistryStyle.setAttribute('data-ww-inline-style-envelope', '');
            const nonce = discoverNonce(nativeDocument);
            if (nonce) inlineRegistryStyle.nonce = nonce;
            nativeDocument.head.appendChild(inlineRegistryStyle);
        }
        const registrations = Array.from(
            inlineProperties,
            property => `@property ${property}{syntax:"*";inherits:false;}`
        ).join('');
        const declarations = Array.from(inlineDeclarations.values()).join('');
        inlineRegistryStyle.textContent = `${registrations}@layer ${layerName} {.${INLINE_STYLE_CLASS}{${declarations}}}`;
    };

    const inlineStyle = value => {
        const normalized = normalizeStyleRecord(value);
        if (!normalized) {
            report(STYLE_ENVELOPE_DIAGNOSTICS.PARSE_FAILED, { reason: 'unsupported-inline-style' });
            return value;
        }

        const output = {};
        for (const [rawProperty, rawValues] of normalized) {
            const property = normalizeStyleProperty(rawProperty);
            if (!isSafeStyleProperty(property)) {
                report(STYLE_ENVELOPE_DIAGNOSTICS.PARSE_FAILED, { reason: 'unsupported-inline-property' });
                output[rawProperty] = rawValues.at(-1);
                continue;
            }
            for (let index = 0; index < rawValues.length; index += 1) {
                const parsed = extractImportant(rawValues[index]);
                if (parsed.value == null) continue;
                const variable = getInlineStyleVariable(property, parsed.important, index);
                output[variable] = parsed.value;
                inlineProperties.add(variable);
                const key = `${property}\u0000${parsed.important}\u0000${index}`;
                inlineDeclarations.set(
                    key,
                    `${property}:var(${variable})${parsed.important ? '!important' : ''};`
                );
            }
        }
        renderInlineStyleRegistry();
        return output;
    };

    const patchSheet = sheet => {
        if (!sheet || patchedSheets.has(sheet)) return sheet;
        patchedSheets.add(sheet);

        const rawInsertRule = findMethod(sheet, 'insertRule');
        const rawDeleteRule = findMethod(sheet, 'deleteRule');
        const rawReplace = findMethod(sheet, 'replace');
        const rawReplaceSync = findMethod(sheet, 'replaceSync');
        const rawCssRules = findPropertyDescriptor(sheet, 'cssRules')?.get;
        if (!rawInsertRule || !rawCssRules) return sheet;

        const getRawRules = () => rawCssRules.call(sheet);
        const getLayerRule = () =>
            Array.from(getRawRules()).find(
                rule => rule?.constructor?.name === 'CSSLayerBlockRule' && rule.name === layerName
            );
        const ensureLayerRule = () => {
            let layerRule = getLayerRule();
            if (layerRule) return layerRule;

            try {
                rawInsertRule.call(sheet, `@layer ${layerName} {}`, getRawRules().length);
                layerRule = getLayerRule();
            } catch (error) {
                report(STYLE_ENVELOPE_DIAGNOSTICS.CSSOM_TOPOLOGY, {
                    reason: 'layer-rule-unavailable',
                    message: error?.message,
                });
            }
            return layerRule;
        };

        defineOwn(sheet, 'cssRules', {
            get() {
                return ensureLayerRule()?.cssRules || getRawRules();
            },
        });
        defineOwn(sheet, 'insertRule', {
            value(rule, index) {
                if (/^\s*@import\b/i.test(rule)) {
                    return rawInsertRule.call(sheet, namespaceImportLayer(rule, layerName), 0);
                }
                const layerRule = ensureLayerRule();
                if (!layerRule) return rawInsertRule.call(sheet, layerCss(rule), index);
                return layerRule.insertRule(rule, index ?? layerRule.cssRules.length);
            },
        });
        if (rawDeleteRule) {
            defineOwn(sheet, 'deleteRule', {
                value(index) {
                    const layerRule = ensureLayerRule();
                    if (!layerRule) return rawDeleteRule.call(sheet, index);
                    return layerRule.deleteRule(index);
                },
            });
        }
        if (rawReplaceSync) {
            defineOwn(sheet, 'replaceSync', {
                value(css) {
                    return rawReplaceSync.call(sheet, layerCss(css));
                },
            });
        }
        if (rawReplace) {
            defineOwn(sheet, 'replace', {
                value(css) {
                    return rawReplace.call(sheet, layerCss(css));
                },
            });
        }

        ensureLayerRule();
        return sheet;
    };

    const decorateStyleElement = style => {
        if (!style || decoratedStyles.has(style)) return style;
        decoratedStyles.add(style);

        transformProperty(style, 'textContent', layerCss);
        transformProperty(style, 'innerHTML', layerCss);

        const rawAppendChild = findMethod(style, 'appendChild');
        if (rawAppendChild) {
            defineOwn(style, 'appendChild', {
                value(node) {
                    if (node?.nodeType === 3) node.textContent = layerCss(node.textContent);
                    return rawAppendChild.call(style, node);
                },
            });
        }

        const sheetDescriptor = findPropertyDescriptor(style, 'sheet');
        if (sheetDescriptor?.get) {
            defineOwn(style, 'sheet', {
                get() {
                    return patchSheet(sheetDescriptor.get.call(style));
                },
            });
        }
        return style;
    };

    const isSimpleStylesheetLink = link => {
        const rel = String(link.rel || link.getAttribute?.('rel') || '').toLowerCase().split(/\s+/);
        if (!rel.includes('stylesheet') || rel.includes('alternate')) return false;
        if (!link.href && !link.getAttribute?.('href')) return false;
        return !(
            link.hasAttribute?.('integrity') ||
            link.hasAttribute?.('crossorigin') ||
            link.hasAttribute?.('referrerpolicy') ||
            link.hasAttribute?.('fetchpriority') ||
            link.hasAttribute?.('title') ||
            link.disabled
        );
    };

    const createLayeredLinkStyle = link => {
        if (!isSimpleStylesheetLink(link)) {
            report(STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_STYLESHEET, { reason: 'unsupported-link-semantics' });
            return null;
        }

        const style = decorateStyleElement(nativeDocument.createElement('style'));
        style.setAttribute?.('data-ww-layered-stylesheet', '');
        const media = link.media || link.getAttribute?.('media');
        if (media) style.media = media;
        const nonce = link.nonce || discoverNonce(nativeDocument);
        if (nonce) style.nonce = nonce;
        const href = link.getAttribute?.('href') || link.href;
        style.textContent = `@import url("${escapeCssString(href)}") layer(${layerName});`;
        return style;
    };

    const prepareNode = node => {
        const tagName = node?.tagName?.toLowerCase?.();
        if (tagName === 'style') return decorateStyleElement(node);
        if (tagName === 'link') return createLayeredLinkStyle(node) || node;
        if (tagName === 'script' && (node.src || node.getAttribute?.('src'))) {
            report(STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_SCRIPT, { reason: 'external-script' });
        }
        return node;
    };

    const proxyContainer = container => {
        if (!container || containerProxies.has(container)) return containerProxies.get(container) || container;
        const proxy = new Proxy(container, {
            get(target, property) {
                if (property === 'appendChild') {
                    return node => {
                        const prepared = prepareNode(node);
                        target.appendChild(prepared);
                        return node;
                    };
                }
                if (property === 'insertBefore') {
                    return (node, reference) => {
                        const prepared = prepareNode(node);
                        target.insertBefore(prepared, reference);
                        return node;
                    };
                }
                if (property === 'append' || property === 'prepend') {
                    return (...nodes) => target[property](...nodes.map(prepareNode));
                }
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            },
        });
        containerProxies.set(container, proxy);
        return proxy;
    };

    const documentProxy = nativeDocument
        ? new Proxy(nativeDocument, {
              set(target, property, value) {
                  return Reflect.set(target, property, value, target);
              },
              get(target, property) {
                  if (property === 'head' || property === 'body') return proxyContainer(target[property]);
                  if (property === 'createElement') {
                      return (tagName, options) => {
                          const element = target.createElement(tagName, options);
                          return String(tagName).toLowerCase() === 'style' ? decorateStyleElement(element) : element;
                      };
                  }
                  if (property === 'querySelector') {
                      return selector => {
                          const result = target.querySelector(selector);
                          return result === target.head || result === target.body ? proxyContainer(result) : result;
                      };
                  }
                  if (property === 'getElementsByTagName') {
                      return tagName => {
                          const result = target.getElementsByTagName(tagName);
                          if (!['head', 'body'].includes(String(tagName).toLowerCase())) return result;
                          return Array.from(result, proxyContainer);
                      };
                  }
                  const value = Reflect.get(target, property, target);
                  return typeof value === 'function' ? value.bind(target) : value;
              },
          })
        : undefined;

    let StyleSheetConstructor = NativeCSSStyleSheet;
    if (NativeCSSStyleSheet) {
        StyleSheetConstructor = function CodedComponentCSSStyleSheet(...args) {
            return patchSheet(new NativeCSSStyleSheet(...args));
        };
        Object.setPrototypeOf(StyleSheetConstructor, NativeCSSStyleSheet);
        StyleSheetConstructor.prototype = NativeCSSStyleSheet.prototype;
    }

    const html = value => transformHtmlInlineStyles(transformHtml(value, { layerCss, layerName, report }), inlineStyle);

    return {
        CSSStyleSheet: StyleSheetConstructor,
        document: documentProxy,
        html,
        inlineStyle,
        layerCss,
    };
}

function normalizeStyleRecord(value) {
    const declarations = new Map();
    if (value == null || value === false) return declarations;

    const merge = entry => {
        if (entry == null || entry === false) return true;
        if (Array.isArray(entry)) {
            for (const item of entry) {
                if (!merge(item)) return false;
            }
            return true;
        }
        if (typeof entry === 'string') {
            const parsed = splitStyleDeclarations(entry);
            if (!parsed) return false;
            for (const [property, styleValue] of parsed) declarations.set(property, [styleValue]);
            return true;
        }
        if (typeof entry !== 'object') return false;
        for (const [property, styleValue] of Object.entries(entry)) {
            if (Array.isArray(styleValue)) {
                declarations.set(property, styleValue);
            } else {
                declarations.set(property, [styleValue]);
            }
        }
        return true;
    };

    return merge(value) ? declarations : null;
}

function splitStyleDeclarations(value) {
    const declarations = [];
    let start = 0;
    let parentheses = 0;
    let quote = null;
    let comment = false;

    for (let index = 0; index <= value.length; index += 1) {
        const character = value[index];
        const next = value[index + 1];
        if (comment) {
            if (character === '*' && next === '/') {
                comment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            if (character === '\\') index += 1;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '/' && next === '*') {
            comment = true;
            index += 1;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '(') {
            parentheses += 1;
        } else if (character === ')') {
            parentheses -= 1;
        } else if ((!parentheses && character === ';') || index === value.length) {
            const declaration = value.slice(start, index).trim();
            start = index + 1;
            if (!declaration) continue;
            const colon = findDeclarationColon(declaration);
            if (colon === -1) return null;
            declarations.push([declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]);
        }
        if (parentheses < 0) return null;
    }
    return comment || quote || parentheses ? null : declarations;
}

function findDeclarationColon(value) {
    let parentheses = 0;
    let quote = null;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (quote) {
            if (character === '\\') index += 1;
            else if (character === quote) quote = null;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '(') {
            parentheses += 1;
        } else if (character === ')') {
            parentheses -= 1;
        } else if (!parentheses && character === ':') {
            return index;
        }
    }
    return -1;
}

function normalizeStyleProperty(property) {
    const value = String(property).trim();
    if (value.startsWith('--')) return value;
    if (value === 'cssFloat') return 'float';
    return value
        .replace(/^ms-/, '-ms-')
        .replace(/^(Webkit|Moz|O)(?=[A-Z])/, match => `-${match.toLowerCase()}-`)
        .replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
}

function isSafeStyleProperty(property) {
    return /^--[a-zA-Z0-9_-]+$/.test(property) || /^-?[a-zA-Z][a-zA-Z0-9-]*$/.test(property);
}

function extractImportant(value) {
    if (value == null || value === false) return { value: null, important: false };
    const normalized = String(value);
    const match = normalized.match(/\s*!important\s*$/i);
    return {
        value: match ? normalized.slice(0, match.index).trimEnd() : normalized,
        important: Boolean(match),
    };
}

function getInlineStyleVariable(property, important, index) {
    const encoded = Array.from(`${property}|${important ? 1 : 0}|${index}`, character =>
        character.codePointAt(0).toString(36)
    ).join('-');
    return `--ww-inline-${encoded}`;
}

function transformHtmlInlineStyles(value, inlineStyle) {
    if (typeof value !== 'string' || !value) return value;

    let output = '';
    let cursor = 0;
    while (cursor < value.length) {
        const open = findNextOpeningTag(value, cursor);
        if (!open) {
            output += value.slice(cursor);
            break;
        }
        output += value.slice(cursor, open.start);
        output += transformInlineStyleTag(value.slice(open.start, open.end), inlineStyle);
        cursor = open.end;

        if ((open.name === 'style' || open.name === 'script') && !open.selfClosing) {
            const close = findClosingTag(value, open.name, cursor);
            if (!close) {
                output += value.slice(cursor);
                break;
            }
            output += value.slice(cursor, close.end);
            cursor = close.end;
        }
    }
    return output;
}

function findNextOpeningTag(html, from) {
    let cursor = from;
    while (cursor < html.length) {
        const start = html.indexOf('<', cursor);
        if (start === -1) return null;
        if (html.startsWith('<!--', start)) {
            const commentEnd = html.indexOf('-->', start + 4);
            cursor = commentEnd === -1 ? html.length : commentEnd + 3;
            continue;
        }
        const match = html.slice(start).match(/^<([a-zA-Z][\w:-]*)\b/);
        if (!match) {
            cursor = start + 1;
            continue;
        }
        const end = findTagEnd(html, start + match[0].length);
        if (end === -1) return null;
        return {
            start,
            end: end + 1,
            name: match[1].toLowerCase(),
            selfClosing: /\/\s*>$/.test(html.slice(start, end + 1)),
        };
    }
    return null;
}

function transformInlineStyleTag(tag, inlineStyle) {
    const attributes = parseHtmlAttributeTokens(tag);
    const styleAttribute = attributes.find(attribute => attribute.name.toLowerCase() === 'style' && attribute.hasValue);
    if (!styleAttribute) return tag;

    const transformed = inlineStyle(decodeHtmlAttribute(styleAttribute.value));
    if (!transformed || typeof transformed !== 'object' || Array.isArray(transformed)) return tag;

    const serializedStyle = Object.entries(transformed)
        .filter(([, value]) => value != null && value !== false)
        .map(([property, value]) => `${property}:${value}`)
        .join(';');
    const replacements = [
        { start: styleAttribute.valueStart, end: styleAttribute.valueEnd, value: escapeHtmlAttribute(serializedStyle) },
    ];
    const classAttribute = attributes.find(attribute => attribute.name.toLowerCase() === 'class' && attribute.hasValue);
    if (classAttribute) {
        const classes = decodeHtmlAttribute(classAttribute.value).split(/\s+/);
        if (!classes.includes(INLINE_STYLE_CLASS)) {
            replacements.push({
                start: classAttribute.valueStart,
                end: classAttribute.valueEnd,
                value: escapeHtmlAttribute(`${decodeHtmlAttribute(classAttribute.value)} ${INLINE_STYLE_CLASS}`.trim()),
            });
        }
    } else {
        const insertion = tag.search(/\/?>\s*$/);
        replacements.push({ start: insertion, end: insertion, value: ` class="${INLINE_STYLE_CLASS}"` });
    }
    return applyStringReplacements(tag, replacements);
}

function parseHtmlAttributeTokens(tag) {
    const attributes = [];
    let cursor = tag.indexOf(' ');
    if (cursor === -1) return attributes;

    while (cursor < tag.length) {
        while (/\s/.test(tag[cursor])) cursor += 1;
        if (tag[cursor] === '>' || tag[cursor] === '/' || cursor >= tag.length) break;
        const nameStart = cursor;
        while (cursor < tag.length && !/[\s=/>]/.test(tag[cursor])) cursor += 1;
        const name = tag.slice(nameStart, cursor);
        while (/\s/.test(tag[cursor])) cursor += 1;
        if (tag[cursor] !== '=') {
            attributes.push({ name, hasValue: false });
            continue;
        }
        cursor += 1;
        while (/\s/.test(tag[cursor])) cursor += 1;
        const quote = tag[cursor] === '"' || tag[cursor] === "'" ? tag[cursor++] : null;
        const valueStart = cursor;
        if (quote) {
            while (cursor < tag.length && tag[cursor] !== quote) cursor += 1;
        } else {
            while (cursor < tag.length && !/[\s>]/.test(tag[cursor])) cursor += 1;
        }
        const valueEnd = cursor;
        if (quote) cursor += 1;
        attributes.push({ name, hasValue: true, value: tag.slice(valueStart, valueEnd), valueStart, valueEnd });
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

function applyStringReplacements(value, replacements) {
    let output = value;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
    }
    return output;
}

function transformHtml(value, { layerCss, layerName, report }) {
    if (typeof value !== 'string' || !value) return value;

    let output = '';
    let cursor = 0;
    while (cursor < value.length) {
        const open = findNextRelevantTag(value, cursor);
        if (!open) {
            output += value.slice(cursor);
            break;
        }

        output += value.slice(cursor, open.start);
        if (open.name === 'style' && !open.selfClosing) {
            const close = findClosingTag(value, 'style', open.end);
            if (!close) {
                report(STYLE_ENVELOPE_DIAGNOSTICS.PARSE_FAILED, { reason: 'unclosed-style-tag' });
                return value;
            }
            output += value.slice(open.start, open.end);
            output += layerCss(value.slice(open.end, close.start));
            output += value.slice(close.start, close.end);
            cursor = close.end;
            continue;
        }

        if (open.name === 'link') {
            const attributes = parseHtmlAttributes(value.slice(open.start, open.end));
            if (isSimpleLinkAttributes(attributes)) {
                const media = attributes.media ? ` media="${escapeHtmlAttribute(attributes.media)}"` : '';
                const nonce = attributes.nonce ? ` nonce="${escapeHtmlAttribute(attributes.nonce)}"` : '';
                output += `<style data-ww-layered-stylesheet${media}${nonce}>@import url("${escapeCssString(
                    attributes.href
                )}") layer(${layerName});</style>`;
            } else {
                report(STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_STYLESHEET, {
                    reason: 'unsupported-link-semantics',
                });
                output += value.slice(open.start, open.end);
            }
            cursor = open.end;
            continue;
        }

        if (open.name === 'script') {
            const attributes = parseHtmlAttributes(value.slice(open.start, open.end));
            if (attributes.src) {
                report(STYLE_ENVELOPE_DIAGNOSTICS.EXTERNAL_SCRIPT, { reason: 'external-script' });
            }
        }
        output += value.slice(open.start, open.end);
        cursor = open.end;
    }
    return output;
}

function findNextRelevantTag(html, from) {
    const pattern = /<(style|link|script)\b/gi;
    pattern.lastIndex = from;
    const match = pattern.exec(html);
    if (!match) return null;

    const end = findTagEnd(html, match.index + match[0].length);
    if (end === -1) return null;
    return {
        start: match.index,
        end: end + 1,
        name: match[1].toLowerCase(),
        selfClosing: /\/\s*>$/.test(html.slice(match.index, end + 1)),
    };
}

function findTagEnd(html, from) {
    let quote = null;
    for (let index = from; index < html.length; index += 1) {
        const character = html[index];
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

function findClosingTag(html, name, from) {
    const pattern = new RegExp(`<\\/${name}\\s*>`, 'gi');
    pattern.lastIndex = from;
    const match = pattern.exec(html);
    return match ? { start: match.index, end: pattern.lastIndex } : null;
}

function parseHtmlAttributes(tag) {
    const attributes = {};
    const start = tag.search(/\s/);
    if (start === -1) return attributes;
    const source = tag.slice(start, tag.lastIndexOf('>'));
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = pattern.exec(source))) {
        attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    return attributes;
}

function isSimpleLinkAttributes(attributes) {
    const rel = String(attributes.rel || '').toLowerCase().split(/\s+/);
    if (!rel.includes('stylesheet') || rel.includes('alternate') || !attributes.href) return false;
    return !['integrity', 'crossorigin', 'referrerpolicy', 'fetchpriority', 'title', 'disabled'].some(attribute =>
        Object.hasOwn(attributes, attribute)
    );
}

function splitTopLevelRules(css) {
    const rules = [];
    let start = 0;
    let braces = 0;
    let parentheses = 0;
    let brackets = 0;
    let quote = null;
    let comment = false;

    for (let index = 0; index < css.length; index += 1) {
        const character = css[index];
        const next = css[index + 1];
        if (comment) {
            if (character === '*' && next === '/') {
                comment = false;
                index += 1;
            }
            continue;
        }
        if (quote) {
            if (character === '\\') {
                index += 1;
            } else if (character === quote) {
                quote = null;
            }
            continue;
        }
        if (character === '/' && next === '*') {
            comment = true;
            index += 1;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '(') {
            parentheses += 1;
        } else if (character === ')') {
            parentheses -= 1;
        } else if (character === '[') {
            brackets += 1;
        } else if (character === ']') {
            brackets -= 1;
        } else if (!parentheses && !brackets && character === '{') {
            braces += 1;
        } else if (!parentheses && !brackets && character === '}') {
            braces -= 1;
            if (!braces) {
                rules.push(css.slice(start, index + 1));
                start = index + 1;
            }
        } else if (!braces && !parentheses && !brackets && character === ';') {
            rules.push(css.slice(start, index + 1));
            start = index + 1;
        }

        if (braces < 0 || parentheses < 0 || brackets < 0) return null;
    }
    if (comment || quote || braces || parentheses || brackets) return null;
    if (start < css.length) rules.push(css.slice(start));
    return rules;
}

function getAtRuleName(rule) {
    const withoutLeadingComments = rule.slice(skipCssTrivia(rule));
    return withoutLeadingComments.match(/^@([\w-]+)/)?.[1]?.toLowerCase() || null;
}

function isExactLayerRule(rule, layerName) {
    const withoutLeadingComments = rule.slice(skipCssTrivia(rule));
    const match = withoutLeadingComments.match(/^@layer\s+([^\s{]+)\s*\{/i);
    return match?.[1] === layerName;
}

function namespaceImportLayer(rule, layerName) {
    const contentEnd = rule.trimEnd().length;
    if (rule[contentEnd - 1] !== ';') return rule;

    let cursor = skipCssTrivia(rule);
    if (rule.slice(cursor, cursor + 7).toLowerCase() !== '@import') return rule;
    cursor = skipCssTrivia(rule, cursor + 7);
    const resourceEnd = consumeImportResource(rule, cursor);
    if (resourceEnd === -1 || resourceEnd > contentEnd) return rule;

    const tail = rule.slice(resourceEnd, contentEnd);
    const layerQualifier = parseImportLayerQualifier(tail);
    let nextTail = ` layer(${layerName})${tail}`;
    if (layerQualifier) {
        const importedLayer = layerQualifier.name;
        const namespaced = !importedLayer || importedLayer === layerName || importedLayer.startsWith(`${layerName}.`)
            ? importedLayer || layerName
            : `${layerName}.${importedLayer}`;
        nextTail =
            tail.slice(0, layerQualifier.start) +
            `layer(${namespaced})` +
            tail.slice(layerQualifier.end);
    }
    return rule.slice(0, resourceEnd) + nextTail + rule.slice(contentEnd);
}

function skipCssTrivia(value, from = 0) {
    let cursor = from;
    while (cursor < value.length) {
        while (/\s/.test(value[cursor])) cursor += 1;
        if (value[cursor] !== '/' || value[cursor + 1] !== '*') break;
        const commentEnd = value.indexOf('*/', cursor + 2);
        if (commentEnd === -1) return value.length;
        cursor = commentEnd + 2;
    }
    return cursor;
}

function consumeImportResource(value, from) {
    if (value[from] === '"' || value[from] === "'") return consumeQuotedValue(value, from);
    if (value.slice(from, from + 4).toLowerCase() !== 'url(') return -1;
    return consumeBalancedParentheses(value, from + 3);
}

function consumeQuotedValue(value, from) {
    const quote = value[from];
    for (let cursor = from + 1; cursor < value.length; cursor += 1) {
        if (value[cursor] === '\\') {
            cursor += 1;
        } else if (value[cursor] === quote) {
            return cursor + 1;
        }
    }
    return -1;
}

function consumeBalancedParentheses(value, openingParenthesis) {
    let depth = 0;
    let quote = null;
    let comment = false;
    for (let cursor = openingParenthesis; cursor < value.length; cursor += 1) {
        const character = value[cursor];
        const next = value[cursor + 1];
        if (comment) {
            if (character === '*' && next === '/') {
                comment = false;
                cursor += 1;
            }
        } else if (quote) {
            if (character === '\\') cursor += 1;
            else if (character === quote) quote = null;
        } else if (character === '/' && next === '*') {
            comment = true;
            cursor += 1;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '(') {
            depth += 1;
        } else if (character === ')') {
            depth -= 1;
            if (!depth) return cursor + 1;
        }
    }
    return -1;
}

function parseImportLayerQualifier(tail) {
    const start = skipCssTrivia(tail);
    if (tail.slice(start, start + 5).toLowerCase() !== 'layer') return null;
    const boundary = tail[start + 5];
    if (boundary && !/[\s(;]/.test(boundary)) return null;

    const afterName = skipCssTrivia(tail, start + 5);
    if (tail[afterName] !== '(') return { start, end: start + 5, name: '' };
    const end = consumeBalancedParentheses(tail, afterName);
    if (end === -1) return null;
    return { start, end, name: tail.slice(afterName + 1, end - 1).trim() };
}

function findPropertyDescriptor(value, property) {
    let current = value;
    while (current) {
        const descriptor = Object.getOwnPropertyDescriptor(current, property);
        if (descriptor) return descriptor;
        current = Object.getPrototypeOf(current);
    }
    return null;
}

function findMethod(value, property) {
    const descriptor = findPropertyDescriptor(value, property);
    return descriptor?.value;
}

function defineOwn(value, property, descriptor) {
    try {
        Object.defineProperty(value, property, { configurable: true, ...descriptor });
    } catch {
        // Some DOM implementations expose non-configurable instance properties. The fail-open path is intentional.
    }
}

function transformProperty(value, property, transform) {
    const descriptor = findPropertyDescriptor(value, property);
    if (!descriptor?.get || !descriptor?.set) return;
    defineOwn(value, property, {
        get() {
            return descriptor.get.call(value);
        },
        set(next) {
            descriptor.set.call(value, transform(next));
        },
    });
}

function discoverNonce(document) {
    return document?.currentScript?.nonce || document?.querySelector?.('style[nonce],script[nonce]')?.nonce || '';
}

function escapeCssString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\f]/g, ' ');
}

function escapeHtmlAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const envelope = createCodedComponentStyleEnvelope();
if (!Object.hasOwn(Object, TEMPLATE_ENVELOPE_SYMBOL)) {
    Object.defineProperty(Object, TEMPLATE_ENVELOPE_SYMBOL, {
        configurable: true,
        value: envelope,
    });
}
if (!globalThis.__wwCodedStyleEnvelope) {
    Object.defineProperty(globalThis, '__wwCodedStyleEnvelope', {
        configurable: true,
        value: envelope,
    });
}

export const CSSStyleSheet = envelope.CSSStyleSheet;
export const document = envelope.document;
export const html = envelope.html;
export const inlineStyle = envelope.inlineStyle;
export const layerCss = envelope.layerCss;
export default envelope;
