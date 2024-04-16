// webpack.config.js
const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const autoprefixer = require("autoprefixer");
const fs = require("fs");
const webpack = require("webpack");

const wewebClientVersion = "1.0.40";

const componentData = {
    name: "",
    version: "",
    componentName: "",
};

const packageJson = {
    wewebClientVersion: wewebClientVersion,
    name: "",
    version: process.env.npm_package_version,
    type: "",
};

fs.writeFileSync("./assets/info.json", JSON.stringify(packageJson), function (err) {
    if (err) {
        throw new Error();
    }
});

module.exports = function () {
    function findPara(param) {
        let result = "";
        process.argv.forEach((argv) => {
            if (argv.indexOf("--" + param) === -1) return;
            result = argv.split("=")[1];
        });
        return result;
    }

    let port = findPara("port");

    try {
        port = parseInt(port);
    } catch (e) {
        port = null;
    }

    const configManager = {
        name: "manager",
        entry: {
            manager: "./assets/index.js",
        },
        mode: "development",
        externals: {
            vue: "Vue",
            react: "React",
            "react-dom": "ReactDOM",
        },
        devtool: "inline-source-map",
        devServer: {
            https: true,
            historyApiFallback: true,
            static: "./assets",
            hot: true,
            allowedHosts: "all",
            client: {
                webSocketURL: {
                    hostname: "localhost",
                    pathname: "/ws",
                    port,
                    protocol: "wss",
                },
            },
            headers: {
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
                "Access-Control-Allow-Origin": "*",
            },
            historyApiFallback: {
                index: "index.html",
            },
        },
        module: {
            rules: [
                {
                    test: /\.(js|css|scss|jsx)$/,
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
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: "javascript/auto",
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
            path: path.join(__dirname, "dist"),
            filename: "[name].js",
        },
        plugins: [
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: "true",
                __VUE_PROD_DEVTOOLS__: "false",
                __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
            }),
            // make sure to include the plugin for the magic
            new VueLoaderPlugin(),
        ],
    };

    if (port) {
        configManager.devServer.port = port;
        configManager.output.publicPath = "https://localhost:" + port + "/";
    } else {
        console.log("\x1b[41mPLEASE DEFINE A PORT (ex : 8080)\x1b[0m");
        return null;
    }

    return [configManager];
};
