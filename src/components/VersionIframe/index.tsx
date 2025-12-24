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
                const pageId = mainUrlParams.get('pageid');
                if (pageId === 'graphql-play-ground') {
                    // Edge case for graphql-play-ground page
                    url.pathname = 'docs/graphql-play-ground/';
                } else {
                    const pageIdSplit = pageId.split('__');
                    if (pageIdSplit.length > 1) {
                        // Tutorials module pages have pageids like {subdirectory}_{real_url_ending}, must be split to generate matching URL
                        const completePath = `tutorials/${pageIdSplit.join(
                            '/',
                        )}/`;
                        url.pathname += completePath;
                    } else {
                        // Other pages are not tutorials with subdirectories, so just add the pageid
                        url.pathname += `${pageId}/`;
                    }
                }
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
