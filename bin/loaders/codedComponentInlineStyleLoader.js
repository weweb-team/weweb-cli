const { transformVueTemplateInlineStyles } = require('../utils/codedComponentStyleEnvelopeWebpack');

module.exports = function codedComponentInlineStyleLoader(source) {
    return transformVueTemplateInlineStyles(source);
};
