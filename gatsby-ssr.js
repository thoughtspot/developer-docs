const React = require('react');
const { SITE_URL } = require('./src/configs/doc-configs');

exports.onRenderBody = ({ setHeadComponents }) => {
    setHeadComponents([
        React.createElement('link', {
            key: 'llms-txt',
            rel: 'llms-txt',
            href: `${SITE_URL}/llms.txt`,
        }),
    ]);
};
