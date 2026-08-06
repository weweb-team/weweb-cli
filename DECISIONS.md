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
- Run local imports through the same PostCSS and Sass pipeline with `css-loader.importLoaders = 2`.
  This keeps dependency CSS transformed and prevents an imported stylesheet from escaping the
  component cascade boundary.
- Keep the plugin CommonJS because the CLI webpack config is CommonJS.
