# Coded Component Styling

This context defines how styles authored by coded components participate in WeWeb's style precedence contract.

## Language

**Coded Component Style Envelope**:
The boundary that makes every supported style emitted by a coded component participate in the component style layer.
_Avoid_: CSS wrapper, style patch

**Component Style Layer**:
The cascade layer reserved for styles owned by coded components, below WeWeb-generated styles.
_Avoid_: User CSS layer, inline layer

**Inline Style Bridge**:
A style value channel whose declarations belong to the Component Style Layer while its changing values remain local to an element.
_Avoid_: Layered inline style, inline override
