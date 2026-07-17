const React = require('react');
const ReactDOM = require('react-dom/client');
const { FloatingAssistantProvider } = require('./src/contexts/FloatingAssistantContext');
const FloatingAssistant = require('./src/components/FloatingAssistant').default;

// Mount FloatingAssistant as a standalone React root — completely outside Gatsby's
// component tree. This avoids any hydration mismatch because Gatsby never SSRs
// this subtree, so there's no server/client tree structure to reconcile.
exports.onClientEntry = () => {
    const container = document.createElement('div');
    container.id = 'floating-assistant-root';
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
        React.createElement(
            FloatingAssistantProvider,
            null,
            React.createElement(FloatingAssistant)
        )
    );
};

exports.onRouteUpdate = ({ location }) => {
    window.dispatchEvent(new CustomEvent('gatsby-route-update', { detail: { location } }));
};
