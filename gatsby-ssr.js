const React = require('react');
const { FloatingAssistantProvider } = require('./src/contexts/FloatingAssistantContext');

exports.wrapRootElement = ({ element }) => (
    <FloatingAssistantProvider>
        {element}
    </FloatingAssistantProvider>
);
