exports.onClientEntry = () => {
    // Dynamic imports so @thoughtspot/radiant-react (which reads `window` at
    // module-load time) is never evaluated during Gatsby's SSR build.
    Promise.all([
        import('./src/contexts/FloatingAssistantContext'),
        import('./src/components/FloatingAssistant'),
        import('react'),
        import('react-dom/client'),
    ]).then(([
        { FloatingAssistantProvider },
        { default: FloatingAssistant },
        React,
        ReactDOM,
    ]) => {
        const container = document.createElement('div');
        container.id = 'floating-assistant-root';
        document.body.appendChild(container);

        ReactDOM.createRoot(container).render(
            React.createElement(
                FloatingAssistantProvider,
                null,
                React.createElement(FloatingAssistant)
            )
        );
    });
};

exports.onRouteUpdate = ({ location }) => {
    window.dispatchEvent(new CustomEvent('gatsby-route-update', { detail: { location } }));
};
