// #! /usr/bin/env node

const prebuildCore = require("../core/prebuild.js");

const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const autoprefixer = require("autoprefixer");
const fs = require("fs");
const webpack = require("webpack");

exports.build = (name, type) => {
    if (!name) {
        console.log("\x1b[41m Error : arg '--name=\"name\"' not specified. \x1b[0m");
        return;
    }
    if (!type) {
        console.log(
            "\x1b[41m Error : arg '--type=\"type\"' not specified. Must be 'section', 'wwobject' or 'plugin'. \x1b[0m"
        );
        return;
    }

    if (!prebuildCore.prebuild({ type })) {
        console.log("BUILD ERROR");
    } else {
        const getPackageJson = function () {
            try {
                let packageJSON;

                packageJSON = fs.readFileSync("./package.json", "utf8");
                packageJSON = JSON.parse(packageJSON);

                return packageJSON;
            } catch (error) {
                console.log("\x1b[41mError : ./package.json not found or incorrect format.\x1b[0m", error);
                return null;
            }
        };

        const packageJSON = getPackageJson();
        if (!packageJSON) {
            console.log("\x1b[41mError : package.json not found\x1b[0m");
            return;
        }

        const version = packageJSON.version;
        const versionRegex = /^[\d\.]*$/g;
        if (!versionRegex.test(version)) {
            console.log(
                "\x1b[41mError : package.json version must be an integer (got : " + packageJSON.version + ")\x1b[0m"
            );
            return;
        }

        const componentData = {
            name,
            version: packageJSON.version,
            componentName: "",
        };

        const wewebCliPath = "./node_modules/@weweb/cli";

        const webpackConfig = {
            name: "manager",
            entry: `${wewebCliPath}/assets/index.js`,
            mode: "production",
            externals: {
                vue: "Vue",
                react: "React",
                "react-dom": "ReactDOM",
            },
            resolve: {
                modules: [path.resolve(`${wewebCliPath}/node_modules`), "node_modules"],
                descriptionFiles: [`${wewebCliPath}/package.json`, "package.json"],
            },
            resolveLoader: {
                modules: [path.resolve(`${wewebCliPath}/node_modules`), "node_modules"],
                descriptionFiles: [`${wewebCliPath}/package.json`, "package.json"],
            },
            module: {
                rules: [
                    {
                        test: /\.(js|css|scss)$/,
                        loader: "weweb-strip-block",
                        options: {
                            blocks: [
                                {
                                    start: "wwFront:start",
                                    end: "wwFront:end",
                                },
                            ],
                        },
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
                                options: {
                                    blocks: [
                                        {
                                            start: "wwFront:start",
                                            end: "wwFront:end",
                                        },
                                    ],
                                },
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
                                {
                                    search: "__COMPONENT_NAME__",
                                    replace: componentData.componentName,
                                },
                            ],
                        },
                    },
                    // this will apply to both plain `.js` files
                    // AND `<script>` blocks in `.vue` files
                    {
                        test: /\.js$/,
                        loader: "babel-loader",
                    },
                    // this will apply to both plain `.css` files
                    // AND `<style>` blocks in `.vue` files
                    {
                        test: /\.(css|scss)$/,
                        use: [
                            "vue-style-loader",
                            "css-loader",
                            {
                                loader: "postcss-loader",
                                options: {
                                    postcssOptions: {
                                        plugins: function () {
                                            return [autoprefixer];
                                        },
                                    },
                                },
                            },
                            "sass-loader",
                        ],
                    },
                    {
                        test: /\.(png|jpg|gif|svg)$/i,
                        use: [
                            {
                                loader: "url-loader",
                                options: {
                                    limit: 8192,
                                },
                            },
                        ],
                    },
                ],
            },
            output: {
                path: path.join(process.cwd(), "dist"),
                filename: "manager.js",
            },
            plugins: [
                // make sure to include the plugin for the magic
                new VueLoaderPlugin(),
            ],
        };

        webpack(webpackConfig, function (err, stats) {
            if (err) {
                console.error(err, stats);
                console.log("\x1b[41mError : build failed.\x1b[0m");
                console.log("\x1b[41mMake sur that package.json version is in correct format (ex: 1.0.4)\x1b[0m");
                return;
            }

            const info = stats.toJson();

            if (stats.hasErrors()) {
                return this.console.error(info.errors);
            }

            if (
                stats &&
                stats.stats &&
                stats.stats[0] &&
                stats.stats[0].compilation &&
                stats.stats[0].compilation.errors &&
                stats.stats[0].compilation.errors.length
            ) {
                console.log(stats.stats[0].compilation.errors);
                return false;
            }
        });
    }
};
