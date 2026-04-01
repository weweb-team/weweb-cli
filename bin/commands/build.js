const prebuildCore = require("../core/prebuild.js");
const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const autoprefixer = require("autoprefixer");
const fs = require("fs");
const webpack = require("webpack");
const output = require("../utils/output.js");
const errors = require("../utils/errors.js");

/**
 * weweb build
 */
function build(options) {
    const name = options.name;
    const type = options.type;

    if (!["section", "wwobject", "plugin"].includes(type)) {
        errors.fatal(
            `Invalid type '${type}'. Must be 'section', 'wwobject', or 'plugin'.`,
            "INVALID_TYPE",
            errors.EXIT_ERROR
        );
        return;
    }

    if (!prebuildCore.prebuild("build", { type })) {
        errors.buildError("Prebuild failed. Check that ww-config.js(on) and component file exist.");
        return;
    }

    const packageJSON = getPackageJson();
    if (!packageJSON) return;

    const version = packageJSON.version;
    const versionRegex = /^[\d\.]*$/g;
    if (!versionRegex.test(version)) {
        errors.fatal(
            `Invalid package.json version '${version}'. Must be digits and dots only (e.g., 1.0.4).`,
            "INVALID_VERSION",
            errors.EXIT_ERROR
        );
        return;
    }

    const componentData = {
        name,
        version: packageJSON.version,
        componentName: "",
    };

    const PACKAGE_DIRECTORY = process.cwd();
    const TMP_BUILD_DIRECTORY = `${PACKAGE_DIRECTORY}/tmp-build`;
    const TMP_INDEX_PATH = path.join(TMP_BUILD_DIRECTORY, "index.js");

    const wewebCliPath = __dirname + "/../..";

    const webpackConfig = {
        name: "manager",
        entry: TMP_INDEX_PATH,
        mode: "production",
        externals: {
            vue: "Vue",
        },
        resolve: {
            modules: ["node_modules", path.resolve(`${wewebCliPath}/node_modules`)],
            descriptionFiles: ["package.json", path.resolve(`${wewebCliPath}/package.json`)],
            fallback: {
                "assert": false, "buffer": false, "child_process": false, "cluster": false,
                "crypto": false, "dgram": false, "dns": false, "domain": false,
                "events": false, "fs": false, "http": false, "https": false,
                "net": false, "os": false, "path": false, "punycode": false,
                "querystring": false, "readline": false, "stream": false, "string_decoder": false,
                "timers": false, "tls": false, "tty": false, "url": false,
                "util": false, "v8": false, "vm": false, "zlib": false,
            },
        },
        resolveLoader: {
            modules: ["node_modules", path.resolve(`${wewebCliPath}/node_modules`)],
            descriptionFiles: ["package.json", path.resolve(`${wewebCliPath}/package.json`)],
        },
        module: {
            rules: [
                {
                    test: /\.(js|css|scss)$/,
                    loader: "weweb-strip-block",
                    options: { blocks: [{ start: "wwFront:start", end: "wwFront:end" }] },
                },
                {
                    test: /\.?(jsx|tsx)(\?.*)?$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-react"],
                            plugins: ["@babel/transform-react-jsx"],
                        },
                    },
                },
                {
                    test: /\.vue$/,
                    use: [
                        "vue-loader",
                        {
                            loader: "weweb-strip-block",
                            options: { blocks: [{ start: "wwFront:start", end: "wwFront:end" }] },
                        },
                    ],
                },
                {
                    test: /\.(js|vue)$/,
                    loader: "string-replace-loader",
                    options: {
                        multiple: [
                            { search: "__NAME__", replace: componentData.name },
                            { search: "__VERSION__", replace: componentData.version },
                            { search: "__COMPONENT_NAME__", replace: componentData.componentName },
                        ],
                    },
                },
                { test: /\.js$/, loader: "babel-loader" },
                { test: /\.mjs$/, include: /node_modules/, type: "javascript/auto" },
                {
                    test: /\.(css|scss)$/,
                    use: [
                        "vue-style-loader",
                        "css-loader",
                        {
                            loader: "postcss-loader",
                            options: {
                                postcssOptions: { plugins: function () { return [autoprefixer]; } },
                            },
                        },
                        "sass-loader",
                    ],
                },
                {
                    test: /\.(png|jpg|gif|svg)$/i,
                    use: [{ loader: "url-loader", options: { limit: 8192 } }],
                },
            ],
        },
        output: {
            path: path.join(process.cwd(), "dist"),
            filename: "manager.js",
        },
        plugins: [
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: "true",
                __VUE_PROD_DEVTOOLS__: "false",
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
            }),
            new VueLoaderPlugin(),
        ],
    };

    output.info("Building component...");

    webpack(webpackConfig, function (err, stats) {
        // Cleanup temp files
        try {
            fs.rmSync(TMP_INDEX_PATH);
            fs.rmdirSync(TMP_BUILD_DIRECTORY);
        } catch {
            // Ignore cleanup errors
        }

        if (err) {
            console.error(err);
            errors.buildError("Webpack compilation failed.");
            return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
            console.error(info.errors);
            errors.buildError("Webpack compilation had errors.");
            return;
        }

        output.success("Build complete.", {
            name,
            type,
            version: packageJSON.version,
            output: "dist/manager.js",
        });
    });
}

function getPackageJson() {
    try {
        return JSON.parse(fs.readFileSync("./package.json", "utf8"));
    } catch (error) {
        errors.fatal("package.json not found or invalid format.", "PACKAGE_JSON_ERROR", errors.EXIT_ERROR);
        return null;
    }
}

module.exports = { build };
