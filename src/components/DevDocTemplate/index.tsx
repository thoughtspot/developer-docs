import React, { useState, useEffect, FC } from 'react';
import { graphql, navigate } from 'gatsby';
import { useResizeDetector } from 'react-resize-detector';
import algoliasearch from 'algoliasearch';

import { Seo } from '../Seo';
import { queryStringParser, isPublicSite } from '../../utils/app-utils';
import { passThroughHandler, fetchChild } from '../../utils/doc-utils';
import Header from '../Header';
import LeftSidebar from '../LeftSidebar';
import Docmap from '../Docmap';
import Document from '../Document';
import Search from '../Search';
import '../../assets/styles/index.scss';
import { getAlgoliaIndex } from '../../configs/algolia-search-config';
import _ from 'lodash';
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
import { SearchQueryResult } from '../../interfaces';
import { getAllPageIds } from '../LeftSidebar/helper';
import t from '../../utils/lang-utils';
import { MIN_LEFT_NAV_WIDTH_DESKTOP } from '../../constants/uiConstants';

// markup
const DevDocTemplate: FC<DevDocTemplateProps> = (props) => {
    const { data, location } = props;
    const {
        curPageNode,
        navNode,
        allAsciidoc: { edges },
    } = data;
    const { width, ref } = useResizeDetector();
    const [params, setParams] = useState({
        [TS_HOST_PARAM]: DEFAULT_HOST,
        [TS_ORIGIN_PARAM]: '',
        [TS_PAGE_ID_PARAM]: 'introduction',
        [NAV_PREFIX]: '',
        [PREVIEW_PREFIX]: `${DEFAULT_PREVIEW_HOST}/#${DEFAULT_APP_ROOT}`,
    });
    const [docTitle, setDocTitle] = useState('');
    const [docContent, setDocContent] = useState('');
    const [navTitle, setNavTitle] = useState('');
    const [docDescription, setDocDescription] = useState('');
    const [navContent, setNavContent] = useState('');
    const [breadcrumsData, setBreadcrumsData] = useState([]);
    const [backLink, setBackLink] = useState('');
    const [allPageIds, setAllPageIds] = useState([]);
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
        CUSTOM_PAGE_ID.API_PLAYGROUND ===
        data?.curPageNode?.pageAttributes?.pageid;

    const playgroundRef = React.useRef<HTMLIFrameElement>(null);
    const apiResourceConfig = React.useRef<string>(null);

    const playgroundUrlTemplate = _.template(
        // eslint-disable-next-line no-template-curly-in-string
        'https://rest-api-sdk-v2-0${version}.vercel.app',
    );

    useEffect(() => {
        // based on query params set if public site is open or not
        setIsPublicSiteOpen(isPublicSite(location.search));

        const paramObj = queryStringParser(location.search);
        edges.map((e) => {
            paramObj[e.node.parent.name] =
                e.node.pageAttributes.pageid || NOT_FOUND_PAGE_ID;
        });

        setParams({ ...params, ...paramObj });
    }, [location.search]);

    useEffect(() => {
        // This is to send navigation events to the parent app (if in Iframe)
        // So that the parent can sync the url.
        window.parent.postMessage(
            {
                params: queryStringParser(location.search),
                subsection: location.hash.split('#')[1] || '',
            },
            '*',
        );
    }, [location.search, location.hash]);

    const setPageContent = (pageid: string = NOT_FOUND_PAGE_ID) => {
        // check if url query param is having pageid or not
        if (pageid) {
            // fetch edge id for specified pageid in the url
            const edgeIndex = edges.findIndex(
                (i) => i.node.pageAttributes[TS_PAGE_ID_PARAM] === pageid,
            );

            // check if we have corresponding document to serve if not redirect to 404
            if (edgeIndex > -1) {
                // get and set page title
                setDocTitle(
                    edges[edgeIndex].node.document.title ||
                        edges[edgeIndex].node.pageAttributes.title,
                );

                // get and set doc page content with dynamic data replaced
                setDocContent(
                    passThroughHandler(edges[edgeIndex].node.html, params),
                );
            } else {
                // pageid not found redirect
                setPageContent(NOT_FOUND_PAGE_ID);
            }
        }
    };
    const setPageContentFromSingleNode = (node: AsciiDocNode) => {
        setDocTitle(node.document.title || node.pageAttributes.title);

        // set description
        setDocDescription(
            node.document.description || node.pageAttributes.description,
        );
        // get and set doc page content with dynamic data replaced
        setDocContent(passThroughHandler(node.html, params));
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

    useEffect(() => {
        setAllPageIds(getAllPageIds(navContent));
    }, [navContent]);
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

    const isExternal = () =>
        !location?.href?.includes('developers.thoughtspot.com/docs');

    const baseUrl = isExternal() ? location?.origin : DEFAULT_HOST;
    const playgroundUrl =
        clusterType === CLUSTER_TYPES.PROD
            ? playgroundUrlTemplate({
                  version: DOC_VERSION_PROD,
              })
            : playgroundUrlTemplate({
                  version: DOC_VERSION_DEV,
              });

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
    }, [curPageNode?.pageAttributes?.pageid]);

    React.useEffect(() => {
        if (isPlaygroundReady) {
            const config = {
                baseUrl,
                accessToken: token,
                apiResourceId: apiResourceConfig?.current,
            };
            const playgroundOrigin = new URL(playgroundUrl)?.origin || '*';
            playgroundRef?.current?.contentWindow?.postMessage(
                {
                    type: 'api-playground-config', //EXTERNAL_PLAYGROUND_EVENTS.CONFIG,
                    ...config,
                },
                playgroundOrigin,
            );
        }
    }, [token, isPlaygroundReady]);

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
            />
        </div>
    );

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
                            backLink={isAPIPlayGround ? 'rest-api-v2' : ''} //
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
        allAsciidoc(sort: { fields: [document___title], order: ASC }) {
            edges {
                node {
                    document {
                        title
                    }
                    pageAttributes {
                        pageid
                        title
                        description
                    }
                    parent {
                        ... on File {
                            name
                        }
                    }
                    html
                }
            }
        }
    }
`;

type DevDocTemplateProps = {
    data: {
        curPageNode: AsciiDocNode;
        navNode: AsciiDocNode;
        allAsciidoc: any;
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
