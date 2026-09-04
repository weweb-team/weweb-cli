const RUNTIME_REQUIRED_MARKER = 'WW_CODED_STYLE_ENVELOPE_RUNTIME_REQUIRED';
const INLINE_BINDINGS_REQUIRED_MARKER = 'WW_CODED_STYLE_ENVELOPE_INLINE_BINDINGS_REQUIRED';

function getStyleEnvelope() {
    const envelope = globalThis.wwLib?.wwCodedStyleEnvelope;
    if (envelope) return envelope;

    throw new Error(
        `[WeWeb] ${RUNTIME_REQUIRED_MARKER} ${INLINE_BINDINGS_REQUIRED_MARKER}: this coded component requires artifact compatibility version 2 (ww-coded-inline-style)`
    );
}

Object.defineProperties(module.exports, {
    CSSStyleSheet: {
        enumerable: true,
        get() {
            return getStyleEnvelope().CSSStyleSheet;
        },
    },
    document: {
        enumerable: true,
        get() {
            return getStyleEnvelope().document;
        },
    },
});
