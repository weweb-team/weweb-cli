#! /usr/bin/env node
var webpack = require("webpack");
var webpackConfig = require("../webpack.build.config.js");
webpack(webpackConfig, function(err, stats) {
    if (err) {
        console.error(err, stats);
        console.log("\x1b[41mError : build failed.\x1b[0m");
        console.log("\x1b[41mMake sur that package.json version is in correct format (ex: 1.0.4)\x1b[0m");
        return;
    }

    if (stats && stats.stats && stats.stats[0] && stats.stats[0].compilation && stats.stats[0].compilation.errors && stats.stats[0].compilation.errors.length) {
        console.log(stats.stats[0].compilation.errors);
        return false;
    }
});
