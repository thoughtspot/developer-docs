import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { IconContext } from '@react-icons/all-files';

const getHTMLFromComponent = (icon: JSX.Element, iconClass?: string) => {
    return ReactDOMServer.renderToStaticMarkup(
        <IconContext.Provider value={{ className: `icon ${iconClass}` }}>
            {icon}
        </IconContext.Provider>,
    );
};

export { getHTMLFromComponent };
