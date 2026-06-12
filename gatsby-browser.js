const React = require('react');
const { FloatingAssistantProvider } = require('./src/contexts/FloatingAssistantContext');
const FloatingAssistant = require('./src/components/FloatingAssistant').default;

exports.wrapRootElement = ({ element }) => (
    <FloatingAssistantProvider>
        {element}
        <FloatingAssistant />
    </FloatingAssistantProvider>
);

exports.onRouteUpdate = ({ location }) => {
    window.dispatchEvent(
        new CustomEvent('gatsby-route-update', { detail: { location } })
    );
};
