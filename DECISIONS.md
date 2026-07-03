# Decisions

## PostCSS Layering

- Use a small PostCSS plugin instead of an `unplugin` wrapper. `weweb-cli` already sends component
  CSS through `postcss-loader`, so a PostCSS plugin is the most direct shared abstraction.
- Wrap compiled coded component CSS in `@layer ww-style-component`.
- Emit the complete layer order before the wrapped CSS:
  `ww-style-component`, `ww-style-library`, `ww-style-section`, `ww-style-element`.
- Leave top-level `@charset` and `@import` outside the layer. CSS requires those rules to stay at
  the top of the stylesheet, and imported CSS is intentionally not rewritten in this pass.
- Keep the plugin CommonJS because the CLI webpack config is CommonJS.
