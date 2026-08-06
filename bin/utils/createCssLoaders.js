const autoprefixer = require('autoprefixer');
const wewebCssLayerPlugin = require('./wewebCssLayerPlugin');

module.exports = function createCssLoaders() {
    return [
        'vue-style-loader',
        {
            loader: 'css-loader',
            options: {
                importLoaders: 2,
            },
        },
        {
            loader: 'postcss-loader',
            options: {
                postcssOptions: {
                    plugins: [wewebCssLayerPlugin(), autoprefixer],
                },
            },
        },
        'sass-loader',
    ];
};
