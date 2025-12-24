import React, { useMemo } from 'react';
import './index.scss';

interface VersionIframeProps {
    iframeUrl: string;
    isDarkMode?: boolean;
    location?: any;
}

const VersionIframe: React.FC<VersionIframeProps> = ({
    iframeUrl,
    isDarkMode = false,
    location,
}) => {
    const finalUrl = useMemo(() => {
        const url = new URL(iframeUrl);

        url.searchParams.set('isDarkMode', String(isDarkMode));

        if (typeof window !== 'undefined') {
            const mainUrlParams = new URLSearchParams(window.location.search);
            if (mainUrlParams.has('pageid')) {
                url.searchParams.set('pageid', mainUrlParams.get('pageid'));
                url.pathname += `${mainUrlParams.get('pageid')}/`;
            } else if (mainUrlParams.has('pageId')) {
                url.searchParams.set('pageid', mainUrlParams.get('pageId'));
            }
            url.searchParams.set('_iframe', '1');
        }

        return url.toString();
    }, [iframeUrl, isDarkMode, location?.search]);

    return (
        <div className="version-iframe-container">
            <iframe src={finalUrl} className="version-iframe" />
        </div>
    );
};

export default VersionIframe;
