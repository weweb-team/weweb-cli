const fs = require("fs");
const path = require("path");

/**
 * Collect all component source files from the project directory.
 * Returns a flat map: { "package.json": "...", "ww-config.js": "...", "src/index.vue": "...", ... }
 */
function collectFiles(projectDir) {
    const files = {};

    // 1. package.json (required)
    const packagePath = path.join(projectDir, "package.json");
    if (!fs.existsSync(packagePath)) {
        throw new Error("package.json not found in current directory.");
    }
    files["package.json"] = fs.readFileSync(packagePath, "utf8");

    // 2. ww-config.js or ww-config.json (required)
    const configJs = path.join(projectDir, "ww-config.js");
    const configJson = path.join(projectDir, "ww-config.json");
    if (fs.existsSync(configJs)) {
        files["ww-config.js"] = fs.readFileSync(configJs, "utf8");
    } else if (fs.existsSync(configJson)) {
        files["ww-config.json"] = fs.readFileSync(configJson, "utf8");
    } else {
        throw new Error("ww-config.js or ww-config.json not found in current directory.");
    }

    // 3. All files in src/ directory (recursive)
    const srcDir = path.join(projectDir, "src");
    if (fs.existsSync(srcDir)) {
        collectDir(srcDir, "src", files);
    }

    return files;
}

/**
 * Recursively collect files from a directory into the map.
 */
function collectDir(dirPath, prefix, files) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.posix.join(prefix, entry.name);

        if (entry.isDirectory()) {
            // Skip node_modules and hidden directories
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
            collectDir(fullPath, relativePath, files);
        } else if (entry.isFile()) {
            // Skip hidden files
            if (entry.name.startsWith(".")) continue;
            files[relativePath] = fs.readFileSync(fullPath, "utf8");
        }
    }
}

/**
 * Detect the component entry file.
 * Returns the relative path or null.
 */
function detectComponentPath(projectDir) {
    // Check package.json weweb.componentPath first
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
        if (pkg.weweb && pkg.weweb.componentPath) {
            const componentPath = path.join(projectDir, pkg.weweb.componentPath);
            if (fs.existsSync(componentPath)) return pkg.weweb.componentPath;
        }
    } catch {
        // Ignore
    }

    // Auto-detect
    const candidates = ["./src/wwElement.vue", "./src/wwSection.vue", "./src/wwPlugin.js"];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(projectDir, candidate))) return candidate;
    }

    return null;
}

module.exports = { collectFiles, detectComponentPath };
