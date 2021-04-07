// webpack.config.js
const path = require("path");
const VueLoaderPlugin = require("vue-loader/lib/plugin");
const autoprefixer = require("autoprefixer");
const fs = require("fs");

const getPackageJson = function() {
    try {
        let packageJSON;

        packageJSON = fs.readFileSync("../../package.json", "utf8");
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
    console.log("\x1b[41mError : package.json version must be an integer (got : " + packageJSON.version + ")\x1b[0m");
    return;
}

const isSection = packageJSON.type == "section";

const componentData = {
    name: "",
    version: isSection ? packageJSON.version : "",
    componentName: "",
};

module.exports = {
    name: "manager",
    entry: "./assets/index.js",
    mode: "production",
    externals: {
        vue: "Vue",
        react: "React",
        'react-dom': 'ReactDOM'
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: "vue-loader",
            },
            {
                test: /\.(js|vue|css|scss|jsx)$/,
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
                            plugins: function() {
                                return [autoprefixer];
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
        ],
    },
    output: {
        path: path.join(__dirname, "../../dist"),
        filename: "manager.js",
    },
    plugins: [
        // make sure to include the plugin for the magic
        new VueLoaderPlugin(),
    ],
};
