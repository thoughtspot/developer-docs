import React, { useState, useEffect, FC } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { graphql, navigate } from 'gatsby';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useResizeDetector } from 'react-resize-detector';
import algoliasearch from 'algoliasearch';
import { Seo } from '../Seo';
import { queryStringParser, isPublicSite } from '../../utils/app-utils';
import { passThroughHandler, fetchChild } from '../../utils/doc-utils';
import Header from '../Header';
import LeftSidebar from '../LeftSidebar';
import _ from 'lodash';
import Docmap from '../Docmap';
import Document from '../Document';
import Search from '../Search';
import '../../assets/styles/index.scss';
import { getAlgoliaIndex } from '../../configs/algolia-search-config';
import {
    DOC_NAV_PAGE_ID,
    TS_HOST_PARAM,
    TS_ORIGIN_PARAM,
    TS_PAGE_ID_PARAM,
    NAV_PREFIX,
    PREVIEW_PREFIX,
    NOT_FOUND_PAGE_ID,
    DEFAULT_HOST,
    DEFAULT_PREVIEW_HOST,
    DEFAULT_APP_ROOT,
    HOME_PAGE_ID,
    CUSTOM_PAGE_ID,
    TS_DEMO_LOGIN,
    TS_SESSION_TOKEN,
    TS_INFO,
    CLUSTER_TYPES,
    TS_REST_API_PLAYGROUND,
} from '../../configs/doc-configs';
import {
    LEFT_NAV_WIDTH_DESKTOP,
    MAX_TABLET_RESOLUTION,
    LEFT_NAV_WIDTH_TABLET,
    MAX_MOBILE_RESOLUTION,
    MAX_CONTENT_WIDTH_DESKTOP,
    MAIN_HEIGHT_WITHOUT_DOC_CONTENT,
    ZERO_MARGIN,
    DOC_VERSION_DEV,
    DOC_VERSION_PROD,
} from '../../constants/uiConstants';
import { getAllPageIds } from '../LeftSidebar/helper';
import t from '../../utils/lang-utils';

const EXTERNAL_PLAYGROUND_EVENTS = {
    READY: 'api-playground-ready',
    URL_CHANGE: 'url-change',
    CONFIG: 'api-playground-config',
    RENDER_PLAY_GROUND: 'render-play-ground',
};

// markup
const DevDocTemplate: FC<DevDocTemplateProps> = (props) => {
    const {
        data,
        location,
        pageContext: { namePageIdMap },
    } = props;

    const { curPageNode, navNode } = data;
    const { width, ref } = useResizeDetector();
    const [params, setParams] = useState({
        [TS_HOST_PARAM]: DEFAULT_HOST,
        [TS_ORIGIN_PARAM]: '',
        [TS_PAGE_ID_PARAM]: curPageNode.pageAttributes.pageid,
        [NAV_PREFIX]: '',
        [PREVIEW_PREFIX]: `${DEFAULT_PREVIEW_HOST}/#${DEFAULT_APP_ROOT}`,
    });
    const [docTitle, setDocTitle] = useState('');
    const [docContent, setDocContent] = useState('');
    const [navTitle, setNavTitle] = useState('');
    const [docDescription, setDocDescription] = useState('');
    const [navContent, setNavContent] = useState('');
    const [breadcrumsData, setBreadcrumsData] = useState([]);
    const [prevPageId, setPrevPageId] = useState('introduction');
    const [backLink, setBackLink] = useState('');
    const [leftNavWidth, setLeftNavWidth] = useState(
        width > MAX_TABLET_RESOLUTION
            ? LEFT_NAV_WIDTH_DESKTOP
            : LEFT_NAV_WIDTH_TABLET,
    );
    const [leftNavOpen, setLeftNavOpen] = useState(false);
    const [keyword, updateKeyword] = useState('');
    const [isPublicSiteOpen, setIsPublicSiteOpen] = useState(false);
    const checkout =
        typeof window !== 'undefined'
            ? localStorage.getItem('theme') === 'dark'
            : null;
    const [isDarkMode, setDarkMode] = useState(checkout);
    const [token, setToken] = useState('=');
    const [isPlaygroundReady, setIsPlaygroundReady] = React.useState(false);
    const [clusterType, setClusterType] = React.useState('');
    const isAPIPlayGround =
        CUSTOM_PAGE_ID.API_PLAYGROUND === params[TS_PAGE_ID_PARAM];
    const playgroundRef = React.useRef<HTMLIFrameElement>(null);
    const isBrowser = () => typeof window !== 'undefined';

    const getApiResourceId = () => {
        if (!isBrowser()) return '';
        const ulrParams = new URLSearchParams(window?.location?.search);
        return ulrParams.get('apiResourceId') ?? '';
    };
    const playgroundUrlTemplate = _.template(
        // eslint-disable-next-line no-template-curly-in-string
        'https://rest-api-sdk-v2-0${version}.vercel.app',
    );
    useEffect(() => {
        // based on query params set if public site is open or not
        setIsPublicSiteOpen(isPublicSite(location.search));

        const paramObj = queryStringParser(location.search);

        setParams({ ...paramObj, ...params });
    }, [location.search]);

    useEffect(() => {
        // This is to send navigation events to the parent app (if in Iframe)
        // So that the parent can sync the url.
        const newParms: {
            pageid?: string;
        } = queryStringParser(location.search);
        newParms.pageid = location?.pathname?.split('/')[1] || '';
        window.parent.postMessage(
            {
                params: newParms,
                subsection: location.hash.split('#')[1] || '',
            },
            '*',
        );
    }, [location.search, location.hash]);

    const setPageContentFromSingleNode = (node: AsciiDocNode) => {
        setDocTitle(node.document.title || node.pageAttributes.title);

        // set description
        setDocDescription(
            node.document.description || node.pageAttributes.description,
        );
        // get and set doc page content with dynamic data replaced
        setDocContent(
            passThroughHandler(node.html, { ...params, ...namePageIdMap }),
        );
    };

    useEffect(() => {
        // get & set left navigation title
        setNavTitle(navNode.pageAttributes.title);

        // get & set left navigation area content with dynamic link creation
        const navContentData = passThroughHandler(navNode.html, params);
        setNavContent(navContentData);

        // set breadcrums data
        setBreadcrumsData(fetchChild(navContentData));

        // get & set left navigation 'Back' button url
        setBackLink(params[TS_ORIGIN_PARAM]);

        // set page title , description and content based on the page node
        setPageContentFromSingleNode(curPageNode);
    }, [params]);

    // fetch adoc translated doc edges using graphql

    const [results, setResults] = useState([]);
    const searchClient = React.useMemo(
        () =>
            algoliasearch(
                process.env.GATSBY_ALGOLIA_APP_ID,
                process.env.GATSBY_ALGOLIA_SEARCH_KEY,
            ),
        [],
    );
    const searchIndex = searchClient.initIndex(getAlgoliaIndex());
    const isExternal = () =>
        !location?.href?.includes('developers.thoughtspot.com/docs');
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
        if (keyword) {
            searchIndex
                .search(keyword, {
                    highlightPreTag: '<em class="searchResultHighlightColor">',
                    highlightPostTag: '</em>',
                })
                .then(({ hits }) => {
                    const t = hits.reduce((acc, cur: any) => {
                        if (cur.typedoc) {
                            acc.push(cur);
                        } else if (cur.pageid) {
                            if (
                                !acc.some((data) => data.pageid === cur.pageid)
                            ) {
                                acc.push(cur);
                            }
                        }
                        return acc;
                    }, []);
                    setResults(t);
                })
                .catch((err) => {
                    console.log(err);
                });
        }
    }, [keyword]);
    React.useEffect(() => {
        if (isPlaygroundReady) {
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
        }
    }, [token, isPlaygroundReady]);
    useEffect(() => {
        if (isAPIPlayGround) {
            setLeftNavWidth(ZERO_MARGIN);
            async function fetchData() {
                try {
                    if (!isExternal()) {
                        await fetch(baseUrl + TS_DEMO_LOGIN, {
                            method: 'POST',
                            headers: {
                                'Content-Type':
                                    'application/x-www-form-urlencoded',
                                Accept: 'application/json',
                            },
                            credentials: 'include',
                        });
                    }
                    const info = await fetch(baseUrl + TS_INFO, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                        credentials: 'include',
                    })
                        .then((res) => res.json())
                        .catch((e) => console.log(e));
                    const cType = info?.configInfo?.clusterType || 'DEV';
                    setClusterType(cType);
                    const response = await fetch(baseUrl + TS_SESSION_TOKEN, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
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
        }
    }, [params[TS_PAGE_ID_PARAM]]);

    React.useEffect(() => {
        setPrevPageId(location?.pathname.split('/')[1] || 'introduction');
    }, [location]);

    React.useEffect(() => {
        if (isAPIPlayGround && isAppEmbedded) {
            setTimeout(() => {
                window.parent.postMessage(
                    {
                        type: EXTERNAL_PLAYGROUND_EVENTS.RENDER_PLAY_GROUND,
                        data: { pageid: prevPageId },
                    },
                    '*',
                );
            }, 300);
        }
    }, [isAPIPlayGround]);

    React.useEffect(() => {
        if (isPlaygroundReady) {
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
        }
    }, [token, isPlaygroundReady]);

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
                        const queryParams = window.location.href.split('#/')[1];
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
    const getBackButtonLink = () => {
        const defaultPath = 'rest-api-v2';
        if (isBrowser() && window?.self !== window?.top) {
            return `${getParentURL()}/#/develop/documentation/en/?pageid=rest-api-v2`;
        }
        return defaultPath;
    };

    const renderPlayGround = () => (
        <div
            className="restApiWrapper"
            style={{
                marginTop: isMaxMobileResolution ? '84px' : '72px',
            }}
        >
            <iframe
                ref={playgroundRef}
                src={playgroundUrl}
                height="100%"
                width="100%"
                onLoad={() => setIsPlaygroundReady(true)}
                id="iframe"
            />
        </div>
    );

    const isAppEmbedded = isBrowser() && window.self !== window.top;

    const optionSelected = (pageid: string, sectionId: string) => {
        updateKeyword('');
        navigate(`/${pageid}#${sectionId}`);
    };

    const isMaxMobileResolution = !(width < MAX_MOBILE_RESOLUTION);

    if (keyword && !results.length) {
        results.push({
            link: '',
            pageid: 'stringnotfound',
            title: `${t('KEYWORD_NOT_FOUND_MSG')} "${keyword}".`,
            type: 'text',
        });
    }

    const calculateDocumentBodyWidth = () => {
        if (isMaxMobileResolution && !isAPIPlayGround) {
            if (width > MAX_CONTENT_WIDTH_DESKTOP) {
                return `${MAX_CONTENT_WIDTH_DESKTOP - 300}px`;
            }
            return `${width - 300}px`;
        }
        return '100%';
    };
    const shouldShowRightNav = params[TS_PAGE_ID_PARAM] !== HOME_PAGE_ID;

    return (
        <>
            <Seo title={docTitle} description={docDescription} />
            <div id="wrapper" data-theme={isDarkMode ? 'dark' : 'light'}>
                {isPublicSiteOpen && <Header location={location} />}
                <main
                    ref={ref as React.RefObject<HTMLDivElement>}
                    className={`dark ${
                        isPublicSiteOpen ? 'withHeaderFooter' : ''
                    }`}
                    style={{
                        height: !docContent && MAIN_HEIGHT_WITHOUT_DOC_CONTENT,
                    }}
                >
                    {!isAPIPlayGround && (
                        <LeftSidebar
                            navTitle={navTitle}
                            navContent={navContent}
                            backLink={backLink}
                            docWidth={width}
                            handleLeftNavChange={setLeftNavWidth}
                            location={location}
                            setLeftNavOpen={setLeftNavOpen}
                            leftNavOpen={leftNavOpen}
                            isPublicSiteOpen={isPublicSiteOpen}
                            isMaxMobileResolution={isMaxMobileResolution}
                            setDarkMode={setDarkMode}
                            isDarkMode={isDarkMode}
                            curPageid={curPageNode.pageAttributes.pageid}
                        />
                    )}
                    <div
                        className="documentBody"
                        style={{
                            width: calculateDocumentBodyWidth(),
                            marginLeft: isMaxMobileResolution
                                ? `${leftNavWidth}px`
                                : '0px',
                        }}
                    >
                        <Search
                            keyword={keyword}
                            onChange={(e: React.FormEvent<HTMLInputElement>) =>
                                updateKeyword(
                                    (e.target as HTMLInputElement).value,
                                )
                            }
                            options={results}
                            optionSelected={optionSelected}
                            leftNavOpen={leftNavOpen}
                            updateKeyword={updateKeyword}
                            isMaxMobileResolution={isMaxMobileResolution}
                            setDarkMode={setDarkMode}
                            isDarkMode={isDarkMode}
                            isPublicSiteOpen={isPublicSiteOpen}
                            backLink={
                                isAPIPlayGround ? getBackButtonLink() : ''
                            } //
                        />
                        {isAPIPlayGround ? (
                            renderPlayGround()
                        ) : (
                            <div className="introWrapper">
                                <Document
                                    shouldShowRightNav={shouldShowRightNav}
                                    pageid={params[TS_PAGE_ID_PARAM]}
                                    docTitle={docTitle}
                                    docContent={docContent}
                                    breadcrumsData={breadcrumsData}
                                    isPublicSiteOpen={isPublicSiteOpen}
                                />
                                {shouldShowRightNav && (
                                    <div>
                                        <Docmap
                                            docContent={docContent}
                                            location={location}
                                            options={results}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
};

export default DevDocTemplate;

export const query = graphql`
    query TemplateQuery($pageId: String = "introduction", $navId: String) {
        curPageNode: asciidoc(pageAttributes: { pageid: { eq: $pageId } }) {
            document {
                title
            }
            pageAttributes {
                title
                pageid
                description
            }
            html
        }
        navNode: asciidoc(pageAttributes: { pageid: { eq: $navId } }) {
            document {
                title
            }
            pageAttributes {
                title
                pageid
                description
            }
            html
        }
    }
`;

type DevDocTemplateProps = {
    data: {
        curPageNode: AsciiDocNode;
        navNode: AsciiDocNode;
        allAsciidoc: any;
    };
    pageContext: {
        namePageIdMap: {
            [key: string]: string;
        };
    };
    location: Location;
};

type AsciiDocNode = {
    document: {
        title?: string;
        description?: string;
    };
    pageAttributes: {
        title?: string;
        pageid: string;
        description?: string;
    };
    html: string;
};
