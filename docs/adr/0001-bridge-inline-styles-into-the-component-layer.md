---
status: accepted
---

# Bridge inline styles into the component layer

Coded component `style` and Vue `:style` declarations are represented by a generated class in `ww-style-component`, with only generated custom-property values left on each element. This preserves Vue reactivity and per-element values while allowing WeWeb-generated styles to override coded-component declarations; leaving real properties inline was rejected because unlayered inline declarations would bypass the layer contract, and rewriting the DOM after render was rejected because it would be costly and hydration-sensitive.

Bridge variables are registered with `@property` and `inherits: false` so a styled descendant cannot accidentally consume a value owned by its parent. This makes support for the CSS Properties and Values API part of the new artifact compatibility contract.

Imperative mutations through `element.style` remain outside this compatibility contract because intercepting the full CSSOM surface would be fragile and would change browser object semantics.
