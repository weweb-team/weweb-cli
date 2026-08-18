const path = require('path');
const valueParser = require('postcss-value-parser');

function rebaseCssUrlsPlugin() {
    return {
        postcssPlugin: 'weweb-rebase-imported-css-urls',
        OnceExit(root, { result }) {
            root.walkDecls(declaration => rebaseDeclarationUrls(declaration, result?.opts?.from));
        },
    };
}

rebaseCssUrlsPlugin.postcss = true;

function rebaseDeclarationUrls(declaration, rootFile) {
    const sourceFile = declaration.source?.input.file;
    if (
        !sourceFile ||
        !rootFile ||
        sourceFile === rootFile ||
        !/(?:url|(?:-webkit-)?image-set)\(/i.test(declaration.value)
    ) {
        return;
    }

    const parsedValue = valueParser(declaration.value);
    let changed = false;
    parsedValue.walk(node => {
        if (node.type !== 'function') return;

        if (node.value.toLowerCase() === 'url') {
            const urlNode = node.nodes[0];
            const rebasedUrl = rebaseUrl(urlNode?.value?.trim(), sourceFile, rootFile);
            if (!rebasedUrl) return false;

            node.nodes = [{ type: 'string', quote: '"', value: rebasedUrl }];
            changed = true;
            return false;
        }

        if (!/^(?:-webkit-)?image-set$/i.test(node.value)) return;

        for (const imageNode of node.nodes) {
            if (imageNode.type === 'function' && imageNode.value.toLowerCase() === 'url') {
                const rebasedUrl = rebaseUrl(imageNode.nodes[0]?.value?.trim(), sourceFile, rootFile);
                if (!rebasedUrl) continue;
                imageNode.nodes = [{ type: 'string', quote: '"', value: rebasedUrl }];
                changed = true;
            } else if (imageNode.type === 'string') {
                const rebasedUrl = rebaseUrl(imageNode.value.trim(), sourceFile, rootFile);
                if (!rebasedUrl) continue;
                imageNode.value = rebasedUrl;
                changed = true;
            }
        }
        return false;
    });

    if (changed) declaration.value = parsedValue.toString();
}

function isRelativeUrl(url) {
    if (!url || url.startsWith('/') || url.startsWith('#') || url.startsWith('//') || url.startsWith('~')) return false;
    return !/^[a-z][a-z\d+.-]*:/i.test(url);
}

function rebaseUrl(url, sourceFile, rootFile) {
    if (!isRelativeUrl(url)) return null;

    const { pathname, suffix } = splitUrlSuffix(url);
    if (!pathname) return null;

    const absolutePath = path.resolve(path.dirname(sourceFile), pathname);
    let rebasedPath = path.relative(path.dirname(rootFile), absolutePath).split(path.sep).join('/');
    if (!rebasedPath.startsWith('.')) rebasedPath = `./${rebasedPath}`;
    return `${rebasedPath}${suffix}`;
}

function splitUrlSuffix(url) {
    const suffixIndex = url.search(/[?#]/);
    if (suffixIndex === -1) return { pathname: url, suffix: '' };
    return { pathname: url.slice(0, suffixIndex), suffix: url.slice(suffixIndex) };
}

module.exports = rebaseCssUrlsPlugin;
