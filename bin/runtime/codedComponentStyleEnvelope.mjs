// This browser runtime is also shipped by weweb-editor for extracted Vite fronts. Keep both copies identical.
const DEFAULT_LAYER = 'ww-style-component';

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

    const html = value => transformHtml(value, { layerCss, layerName, report });

    return {
        CSSStyleSheet: StyleSheetConstructor,
        document: documentProxy,
        html,
        layerCss,
    };
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
    const withoutLeadingComments = rule.replace(/^(?:\s|\/\*[\s\S]*?\*\/)+/, '');
    return withoutLeadingComments.match(/^@([\w-]+)/)?.[1]?.toLowerCase() || null;
}

function isExactLayerRule(rule, layerName) {
    const withoutLeadingComments = rule.replace(/^(?:\s|\/\*[\s\S]*?\*\/)+/, '');
    const match = withoutLeadingComments.match(/^@layer\s+([^\s{]+)\s*\{/i);
    return match?.[1] === layerName;
}

function namespaceImportLayer(rule, layerName) {
    const match = rule.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*@import\s+)(url\((?:[^)'"\\]|\\.|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')*\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')([\s\S]*?;)\s*$/i);
    if (!match) return rule;

    const tail = match[3];
    const layerMatch = tail.match(/\blayer(?:\s*\(\s*([^)]*)\s*\))?/i);
    let nextTail;
    if (!layerMatch) {
        nextTail = ` layer(${layerName})${tail}`;
    } else {
        const importedLayer = layerMatch[1]?.trim();
        const namespaced = !importedLayer || importedLayer === layerName || importedLayer.startsWith(`${layerName}.`)
            ? importedLayer || layerName
            : `${layerName}.${importedLayer}`;
        nextTail = tail.slice(0, layerMatch.index) + `layer(${namespaced})` + tail.slice(layerMatch.index + layerMatch[0].length);
    }
    return `${match[1]}${match[2]}${nextTail}`;
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
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const envelope = createCodedComponentStyleEnvelope();
if (!globalThis.__wwCodedStyleEnvelope) {
    Object.defineProperty(globalThis, '__wwCodedStyleEnvelope', {
        configurable: true,
        value: envelope,
    });
}

export const CSSStyleSheet = envelope.CSSStyleSheet;
export const document = envelope.document;
export const html = envelope.html;
export const layerCss = envelope.layerCss;
export default envelope;
