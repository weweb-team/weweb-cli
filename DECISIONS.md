# Decisions

## PostCSS Layering

- Use a small PostCSS plugin instead of an `unplugin` wrapper. `weweb-cli` already sends component
  CSS through `postcss-loader`, so a PostCSS plugin is the most direct shared abstraction.
- Wrap compiled coded component CSS in `@layer ww-style-component`.
- Leave the complete layer order to the host editor/publisher stylesheet. The CLI only owns the
  coded component layer and must not establish the global order before the host CSS loads.
- Leave top-level `@charset` and `@import` at the top of the stylesheet, as required by CSS, but
  namespace every import into `ww-style-component`. Existing import layers become nested component
  layers, and unlayered local or remote imports receive the component layer explicitly.
- Inline local CSS imports before applying the component layer, while retaining
  `css-loader.importLoaders = 2` for the loader pipeline. This keeps dependency CSS transformed,
  matches Vite's import processing, and prevents a local dependency from being wrapped in the
  component layer twice. Rebase dependency asset URLs before `css-loader` resolves them so they
  remain relative to the stylesheet that authored them.
- Leave imports remaining after local inlining as literal CSS instead of letting `css-loader`
  extract them. They are external imports, and keeping their `layer`, `supports`, and media
  qualifiers in the CSS is required because `vue-style-loader` does not forward that metadata.
- Keep the plugin CommonJS because the CLI webpack config is CommonJS.
