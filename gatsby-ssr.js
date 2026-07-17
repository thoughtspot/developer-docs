const React = require('react');
const RADIANT_SPRITE = require('./src/components/FloatingAssistant/radiantSprite');

exports.onRenderBody = ({ setPreBodyComponents }) => {
    setPreBodyComponents([
        React.createElement('div', {
            key: 'radiant-sprite',
            dangerouslySetInnerHTML: { __html: RADIANT_SPRITE },
        }),
    ]);
};
