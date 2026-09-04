# Coded Component Styling

This context defines how styles authored by coded components participate in WeWeb's style precedence contract.

## Language

**Coded Component Style Envelope**:
The boundary that makes every supported style emitted by a coded component participate in the component style layer.
_Avoid_: CSS wrapper, style patch

**Component Style Layer**:
The `ww-style-component` cascade layer reserved for stylesheet rules owned by coded components, below WeWeb-generated styles. Inline declarations use the companion Inline Style Bridge Layers.
_Avoid_: User CSS layer, inline layer

**Inline Style Bridge Layers**:
The `ww-style-component-inline` and `ww-style-component-inline-important` layers that preserve normal and important inline declaration precedence while keeping actual values in element-local custom properties.
_Avoid_: Component Style Layer, unlayered inline styles

**Inline Style Bridge**:
A style value channel whose generated declarations belong to the Inline Style Bridge Layers while its changing values remain local to an element. Variant classes account for declaration position; fallback arrays and direct declaration strings also account for candidate values.
_Avoid_: Layered inline style, inline override

**Host Style Envelope Runtime**:
The single TypeScript implementation owned by `wwFront` and exposed to coded components through `wwLib.wwCodedStyleEnvelope`.
_Avoid_: CLI runtime, embedded style envelope

**Style Envelope Build Adapter**:
A build-time transform or small forwarding module that targets the Host Style Envelope Runtime without copying its implementation into an artifact.
_Avoid_: Runtime copy, compatibility shim
