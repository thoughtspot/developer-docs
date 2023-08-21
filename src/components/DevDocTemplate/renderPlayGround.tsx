import React, { useState, useEffect, FC } from 'react';
import _ from 'lodash';

import {
    DEFAULT_HOST,
    TS_DEMO_LOGIN,
    TS_SESSION_TOKEN,
    TS_INFO,
    CLUSTER_TYPES,
} from '../../configs/doc-configs';
import { DOC_VERSION_DEV, DOC_VERSION_PROD } from '../../constants/uiConstants';
import BackButton from '../BackButton';

const EXTERNAL_PLAYGROUND_EVENTS = {
    READY: 'api-playground-ready',
    URL_CHANGE: 'url-change',
    CONFIG: 'api-playground-config',
    RENDER_PLAY_GROUND: 'render-play-ground',
};

const RenderPlayGround: FC<RenderPlayGroundProps> = (props) => {
    const { location, backLink } = props;

    const isBrowser = () => typeof window !== 'undefined';

    const isAppEmbedded = isBrowser() && window.self !== window.top;
    const [isPlaygroundReady, setIsPlaygroundReady] = React.useState(false);

    const [prevPageId, setPrevPageId] = useState('introduction');

    const [token, setToken] = useState('');
    const [clusterType, setClusterType] = React.useState('');

    const playgroundRef = React.useRef<HTMLIFrameElement>(null);

    const getApiResourceId = () => {
        if (!isBrowser()) return '';
        const ulrParams = new URLSearchParams(window?.location?.search);
        return ulrParams.get('apiResourceId') ?? '';
    };
    const playgroundUrlTemplate = _.template(
        // eslint-disable-next-line no-template-curly-in-string
        'https://rest-api-sdk-v2-0${version}.vercel.app',
    );

    const isExternal = () =>
        !(
            location?.href?.includes('thoughtspot') ||
            location?.href?.includes('vercel.app')
        );

    const getParentURL = () => {
        let parentUrl = location?.origin;
        if (isBrowser()) {
            const { ancestorOrigins } = window?.location;
            parentUrl =
                ancestorOrigins?.length > 0
                    ? ancestorOrigins[ancestorOrigins?.length - 1]
                    : document.referrer || window?.origin;
        }
        return parentUrl;
    };
    const baseUrl = isExternal() ? getParentURL() : DEFAULT_HOST;

    const playgroundUrl =
        clusterType === CLUSTER_TYPES.PROD
            ? playgroundUrlTemplate({ version: DOC_VERSION_PROD })
            : playgroundUrlTemplate({ version: DOC_VERSION_DEV });

    useEffect(() => {
        async function fetchData() {
            try {
                if (!isExternal()) {
                    await fetch(baseUrl + TS_DEMO_LOGIN, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            Accept: 'application/json',
                        },
                        credentials: 'include',
                    });
                }
                const headers = {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                };
                const info = await fetch(baseUrl + TS_INFO, {
                    method: 'GET',
                    headers,
                    credentials: 'include',
                })
                    .then((res) => res.json())
                    .catch((e) => console.log(e));
                const cType = info?.configInfo?.clusterType || 'DEV';
                setClusterType(cType);
                const response = await fetch(baseUrl + TS_SESSION_TOKEN, {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({
                        operationName: 'GetSessionToken',
                        variables: {},
                        query:
                            'query GetSessionToken {\n  restapiV2__getSessionToken {\n    token\n    __typename\n  }\n}\n',
                    }),
                });
                const data = await response.json();
                const token = data?.data?.restapiV2__getSessionToken?.token;
                setToken(token);
            } catch (e) {
                console.log(e);
            }
        }

        fetchData();
    }, []);

    React.useEffect(() => {
        if (isAppEmbedded) {
            const RENDER_PLAY_GROUND = 'render-play-ground';
            setTimeout(() => {
                window.parent.postMessage(
                    {
                        type: RENDER_PLAY_GROUND,
                        data: { pageid: prevPageId },
                    },
                    '*',
                );
            }, 300);
        }
    }, []);

    React.useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === EXTERNAL_PLAYGROUND_EVENTS.URL_CHANGE) {
                if (event.data?.data && event.data.data !== 'http') {
                    const path = window?.location?.pathname;
                    const currentUrl = window.location.search;
                    var searchParams = new URLSearchParams(currentUrl);
                    const queryParams = window.location.search;
                    var searchParams = new URLSearchParams(queryParams);
                    searchParams.set('apiResourceId', event.data.data);
                    const newUrl = `${getParentURL()}${path}?${searchParams?.toString()}`;
                    if (window.self !== window.top) {
                        if (isAppEmbedded) {
                            window.parent.postMessage(
                                {
                                    type: 'url-change',
                                    data: event.data.data,
                                },
                                '*',
                            );
                        } else window.history.replaceState(null, '', newUrl);
                    } else {
                        window.history.replaceState(null, '', newUrl);
                    }
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    /**
     * @description: Setting apiresource id in url params
     */
    const sendURLParamsToPlayGround = () => {
        const config = {
            baseUrl,
            accessToken: token,
            apiResourceId: getApiResourceId(),
        };
        const playgroundOrigin = new URL(playgroundUrl)?.origin || '*';
        playgroundRef?.current?.contentWindow?.postMessage(
            {
                type: EXTERNAL_PLAYGROUND_EVENTS.CONFIG,
                ...config,
            },
            playgroundOrigin,
        );
    };

    /**
     * @description: Insted of rendering this application navigate to existing playground in develop portal
     */
    const updateParentTORenderPlayGround = () => {
        setTimeout(() => {
            window.parent.postMessage(
                {
                    type: EXTERNAL_PLAYGROUND_EVENTS.RENDER_PLAY_GROUND,
                    data: { pageid: prevPageId },
                },
                '*',
            );
        }, 300); // Adding timeout to handle redirection in develop portal
    };

    React.useEffect(() => {
        if (isPlaygroundReady) {
            sendURLParamsToPlayGround();
            if (isAppEmbedded) updateParentTORenderPlayGround();
        }
    }, [token, isPlaygroundReady]);

  
    return (
        <div className="restApiWrapper">
            <BackButton title="Back" backLink={backLink} internalRedirect/>
            <iframe
                ref={playgroundRef}
                src={playgroundUrl}
                height="100%"
                width="100%"
                id="restAPIPlayGround"
                onLoad={() => setIsPlaygroundReady(true)}
            />
        </div>
    );
};

export default RenderPlayGround;

type RenderPlayGroundProps = {
    location: Location;
    backLink: string
};
