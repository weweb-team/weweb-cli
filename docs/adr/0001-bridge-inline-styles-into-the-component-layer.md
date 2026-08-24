---
status: accepted
---

# Bridge inline styles into the component layer

Coded component `style` and Vue `:style` declarations are represented by deterministic classes in the dedicated `ww-style-component-inline` and `ww-style-component-inline-important` layers, with only generated custom-property values left on each element. Reusable single-value variants include the property, priority, and declaration position in their shape. Fallback arrays and direct declaration strings use value-specific variants because their mutually exclusive `@supports` conditions depend on the candidate values. Keeping the declaration position in every variant preserves shorthand/longhand order independently for elements whose style objects use different property orders.

The compiler emits one `v-bind` object so the original style expression is evaluated once while Vue merges the generated classes with existing static and dynamic classes. This preserves Vue reactivity, per-element values, fallback selection, declaration-block priority, and the native distinction between normal and `!important` declarations. Normal WeWeb-generated styles remain above normal coded-component inline styles, while the dedicated important layer preserves the reversed layer precedence required by CSS `!important`. Leaving real properties inline was rejected because unlayered inline declarations would bypass the layer contract, and rewriting the DOM after render was rejected because it would be costly and hydration-sensitive.

Bridge variables are registered with `@property` and `inherits: false` so a styled descendant cannot accidentally consume a value owned by its parent. This makes support for the CSS Properties and Values API part of the new artifact compatibility contract.

The implementation lives once in `wwFront` as a TypeScript module and is exposed through `wwLib.wwCodedStyleEnvelope`. The CLI only compiles Vue directives and forwards free CSSOM globals to that interface. Extracted Vite fronts import the same singleton for module-evaluation-time CSSOM access, before Vue global properties exist. Embedding a second runtime in CLI artifacts was rejected because it duplicated ownership, tests, and fixes across release units.

Imperative mutations through `element.style` remain outside this compatibility contract because intercepting the full CSSOM surface would be fragile and would change browser object semantics.
