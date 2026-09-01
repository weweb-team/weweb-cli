const autoprefixer = require('autoprefixer');
const postcssImport = require('postcss-import');
const rebaseCssUrlsPlugin = require('./rebaseCssUrlsPlugin');
const wewebCssLayerPlugin = require('./wewebCssLayerPlugin');

module.exports = function createCssLoaders() {
    return [
        'vue-style-loader',
        {
            loader: 'css-loader',
            options: {
                importLoaders: 2,
                import: {
                    // postcss-import already inlines local dependencies. Keeping the remaining
                    // external imports as CSS preserves layer/support/media qualifiers because
                    // vue-style-loader does not forward css-loader import metadata.
                    filter: () => false,
                },
            },
        },
        {
            loader: 'postcss-loader',
            options: {
                postcssOptions: {
                    plugins: [postcssImport(), rebaseCssUrlsPlugin(), wewebCssLayerPlugin(), autoprefixer],
                },
            },
        },
        'sass-loader',
    ];
};
