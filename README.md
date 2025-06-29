# WeWeb CLI

[![pkg.pr.new](https://pkg.pr.new/badge/weweb-team/weweb-cli)](https://pkg.pr.new/~/weweb-team/weweb-cli)

Command-line interface for building WeWeb components (elements, sections, and plugins).

## Installation

```bash
npm install -g @weweb/cli
```

## Usage

### Single Component Mode

For traditional single-component repositories:

#### Serve

> Default port is 8080.

```bash
npm run weweb serve [-- port=port]
yarn weweb serve [-- port=port]
```

#### Build

```bash
npm run weweb build -- name=name type=type
yarn weweb build -- name=name type=type
```

### Monorepo Mode

The CLI now supports monorepos containing multiple WeWeb components in a single repository.

#### Setting up a Monorepo

Create a `package.json` in your monorepo root with the following structure:

```json
{
  "name": "@myorg/weweb-components-monorepo",
  "version": "1.0.0",
  "scripts": {
    "build": "weweb build",
    "build:custom": "weweb build --output=my-components.js",
    "list": "weweb list"
  },
  "weweb": {
    "monorepo": true,
    "components": [
      {
        "name": "my-button",
        "path": "components/my-button",
        "type": "element"
      },
      {
        "name": "my-hero-section",
        "path": "components/my-hero-section",
        "type": "section"
      },
      {
        "name": "my-analytics",
        "path": "components/my-analytics",
        "type": "plugin"
      }
    ]
  },
  "devDependencies": {
    "@weweb/cli": "latest"
  }
}
```

#### Monorepo Structure

```
my-monorepo/
├── package.json
├── components/
│   ├── my-button/
│   │   ├── package.json
│   │   ├── ww-config.js
│   │   └── src/
│   │       └── wwElement.vue
│   ├── my-hero-section/
│   │   ├── package.json
│   │   ├── ww-config.js
│   │   └── src/
│   │       └── wwSection.vue
│   └── my-analytics/
│       ├── package.json
│       ├── ww-config.js
│       └── src/
│           └── wwPlugin.js
└── dist/
    └── monorepo-bundle.js
```

#### Monorepo Commands

```bash
# List all components in the monorepo
weweb list

# Build all components into a single bundle
weweb build

# Build with custom output filename
weweb build --output=my-components.js
```

#### Monorepo Benefits

1. **Single Bundle**: All components are bundled into one JavaScript file, enabling better tree-shaking and optimization
2. **Unified Versioning**: All components share the same version from the root package.json
3. **Easier Maintenance**: Manage dependencies and tooling in one place
4. **Better Code Sharing**: Components can share utilities and common code

#### Component Configuration

The `weweb.components` array supports multiple formats:

```json
// Object format with explicit configuration
{
  "components": [
    {
      "name": "my-button",
      "path": "components/my-button",
      "type": "element"  // "element", "section", or "plugin"
    }
  ]
}

// Object map format
{
  "components": {
    "my-button": {
      "path": "components/my-button",
      "type": "element"
    }
  }
}

// Simple array format (type will be auto-detected)
{
  "components": [
    "components/my-button",
    "components/my-section"
  ]
}
```

## Build Output

### Single Component Mode
- Output: `dist/manager.js`
- Contains: One component

### Monorepo Mode
- Output: `dist/monorepo-bundle.js` (or custom name via `--output`)
- Contains: All components in a single bundle
- Automatically registers all components when loaded

## Requirements

- Node.js 14+
- Each component must have:
  - A `ww-config.js` or `ww-config.json` file
  - A component file (`wwElement.vue`, `wwSection.vue`, or `wwPlugin.js`)

## Tree Shaking

In monorepo mode, the bundle is optimized for tree shaking. WeWeb will only load the components that are actually used in a project, even though all components are included in the bundle.
