const React = require('react');
const RADIANT_SPRITE = require('./src/components/FloatingAssistant/radiantSprite');
const { SITE_URL } = require('./src/configs/doc-configs');

exports.onRenderBody = ({ setHeadComponents, setPreBodyComponents }) => {
    setHeadComponents([
        React.createElement('link', {
            key: 'llms-txt',
            rel: 'llms-txt',
            href: `${SITE_URL}/llms.txt`,
        }),
    ]);

    // Visually-hidden body element — picked up by agent crawlers that parse the DOM
    // but ignore <head> link tags (Mintlify llms-txt-directive-html check).
    setPreBodyComponents([
        React.createElement(
            'div',
            {
                key: 'llms-txt-directive',
                style: {
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                },
            },
            React.createElement(
                'a',
                { href: `${SITE_URL}/llms.txt` },
                'LLMs.txt: Complete documentation index for AI agents',
            ),
            React.createElement(
              'div', {
              key: 'radiant-sprite',
              dangerouslySetInnerHTML: { __html: RADIANT_SPRITE },
          }),
        ),
    ]);
};
