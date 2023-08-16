import React, { useState, useEffect, FC } from 'react';
import Modal from 'react-modal';
// eslint-disable-next-line import/no-extraneous-dependencies
import { graphql, navigate } from 'gatsby';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useResizeDetector } from 'react-resize-detector';
import algoliasearch from 'algoliasearch';
import _ from 'lodash';
import { BiSearch } from '@react-icons/all-files/bi/BiSearch';
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
import RenderPlayGround from './renderPlayGround';
import { AskDocs } from './askDocs';
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
} from '../../configs/doc-configs';
import {
    LEFT_NAV_WIDTH_DESKTOP,
    MAX_TABLET_RESOLUTION,
    LEFT_NAV_WIDTH_TABLET,
    MAX_MOBILE_RESOLUTION,
    MAX_CONTENT_WIDTH_DESKTOP,
    MAIN_HEIGHT_WITHOUT_DOC_CONTENT,
} from '../../constants/uiConstants';
import { getAllPageIds } from '../LeftSidebar/helper';
import t from '../../utils/lang-utils';
import { getHTMLFromComponent } from '../../utils/react-utils';

// markup
const DevDocTemplate: FC<DevDocTemplateProps> = (props) => {
    const {
        data,
        location,
        pageContext: { namePageIdMap },
    } = props;
    const homePagePaths = [
        '/',
        '/docs',
        '/docs/',
        '/docs/introduction',
        '/docs/introduction/',
    ];
    const isHomePage = homePagePaths.includes(location?.pathname);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (location.pathname === '/') {
                navigate('/docs', { replace: true });
            }

            const queryParams = new URLSearchParams(window.location.search);
            const pageId = queryParams.get('pageid');
            if (pageId) {
                queryParams.delete('pageid');
                if (queryParams.toString()) {
                    navigate(`/docs/${pageId}?${queryParams.toString()}`, {
                        replace: true,
                    });
                } else {
                    navigate(`/docs/${pageId}`, { replace: true });
                }
            }
        }
    }, [location.search, location.pathname]);

    const { curPageNode, navNode } = data;
    const { width, ref } = useResizeDetector();
    const [params, setParams] = useState({
        [TS_HOST_PARAM]: DEFAULT_HOST,
        [TS_ORIGIN_PARAM]: '',
        [TS_PAGE_ID_PARAM]: curPageNode.pageAttributes.pageid,
        [NAV_PREFIX]: '/docs',
        [PREVIEW_PREFIX]: `${DEFAULT_PREVIEW_HOST}/#${DEFAULT_APP_ROOT}`,
    });
    const [docTitle, setDocTitle] = useState(
        curPageNode.document.title || curPageNode.pageAttributes.title || '',
    );
    const [docContent, setDocContent] = useState(
        passThroughHandler(curPageNode.html, { ...params, ...namePageIdMap }) ||
            '',
    );
    const [navTitle, setNavTitle] = useState(
        navNode.pageAttributes.title || '',
    );
    const [docDescription, setDocDescription] = useState(
        curPageNode.document.description ||
            curPageNode.pageAttributes.description ||
            '',
    );

    const initialNavContentData = passThroughHandler(navNode.html, params);
    const [navContent, setNavContent] = useState(initialNavContentData || '');
    const [breadcrumsData, setBreadcrumsData] = useState(
        fetchChild(initialNavContentData) || [],
    );
    const [prevPageId, setPrevPageId] = useState('introduction');
    const [backLink, setBackLink] = useState(params[TS_ORIGIN_PARAM]);
    const [showSearch, setShowSearch] = useState(false);
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
    const [key, setKey] = useState('');

    const isCustomPage = _.values(CUSTOM_PAGE_ID).some(
        (pageId: string) => pageId === params[TS_PAGE_ID_PARAM],
    );
    const isApiPlaygroundPage =
        params[TS_PAGE_ID_PARAM] === CUSTOM_PAGE_ID.API_PLAYGROUND;
    const isAskDocsPage = params[TS_PAGE_ID_PARAM] === CUSTOM_PAGE_ID.ASK_DOCS;

    useEffect(() => {
        // based on query params set if public site is open or not
        setIsPublicSiteOpen(isPublicSite(location.search));

        const paramObj = queryStringParser(location.search);

        setParams({ ...paramObj, ...params });
    }, [location.search]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setDarkMode(localStorage.getItem('theme') === 'dark');
            setKey('dark');
        }
    }, []);
    const getSearch = () => {
        const SearchIconHTML = getHTMLFromComponent(<BiSearch />, 'searchIcon');

        const template = `<div class="searchInputBanner">
            <div class="searchInputWrapper">
                <div class="searchInputContainer">
                    ${SearchIconHTML}
                    <div id="search-input-banner" class="search-input-banner" >${t(
                        'SEARCH_PLACEHOLDER',
                    )}</div>
                </div>
            </div>
        </div>`;
        return template;
    };

    useEffect(() => {
        setTimeout(() => {
            const el = document.querySelector('#homePageSearchBar');

            if (el !== null) {
                el.innerHTML = getSearch();

                const searchEl = document.querySelector('#search-input-banner');
                searchEl.addEventListener('click', () => {
                    setShowSearch(true);
                });
            }
        }, 200);
    }, []);

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

    useEffect(() => {
        // get & set left navigation 'Back' button url
        setBackLink(params[TS_ORIGIN_PARAM]);
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
        setPrevPageId(location?.pathname.split('/')[1] || 'introduction');
    }, [location]);

    const optionSelected = (pageid: string, sectionId: string) => {
        updateKeyword('');
        navigate(`/docs/${pageid}#${sectionId}`);
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
        if (isMaxMobileResolution && !isCustomPage && !isHomePage) {
            if (width > MAX_CONTENT_WIDTH_DESKTOP) {
                return `${MAX_CONTENT_WIDTH_DESKTOP - 300}px`;
            }
            return `${width - 300}px`;
        }
        return '100%';
    };
    const shouldShowRightNav = params[TS_PAGE_ID_PARAM] !== HOME_PAGE_ID;
    Modal.setAppElement('#___gatsby');
    const renderSearch = () => {
        const customStyles = {
            overlay: {
                background: 'rgba(50,57,70, 0.9)',
            },
            content: {
                top: '50px',
                left: 'auro',
                right: 'auto',
                bottom: 'auto',
                width: isMaxMobileResolution ? '40%' : '100%',
                margin: 'auto',
                transform: `translate(${
                    isMaxMobileResolution ? '80%' : '0'
                }, 70px)`,
                border: 'none',
                height: isMaxMobileResolution ? '400px' : '300px',
                boxShadow: 'none',
                background: isDarkMode ? '#21252c' : '#fff',
                padding: 0,
            },
        };
        return (
            <Modal
                isOpen={showSearch}
                onRequestClose={() => setShowSearch(false)}
                style={customStyles}
            >
                <div
                    id="docsModal"
                    data-theme={isDarkMode ? 'dark' : 'light'}
                    style={{ height: '100%' }}
                >
                    <Search
                        keyword={keyword}
                        onChange={(e: React.FormEvent<HTMLInputElement>) =>
                            updateKeyword((e.target as HTMLInputElement).value)
                        }
                        options={results}
                        optionSelected={optionSelected}
                        leftNavOpen={leftNavOpen}
                        updateKeyword={updateKeyword}
                        isMaxMobileResolution={isMaxMobileResolution}
                        setDarkMode={setDarkMode}
                        isDarkMode={isDarkMode}
                        isPublicSiteOpen={isPublicSiteOpen}
                        leftNavWidth={leftNavWidth}
                    />
                </div>
            </Modal>
        );
    };

    const renderDocTemplate = () => (
        <>
            {renderSearch()}
            <div className="leftNavContainer">
                <LeftSidebar
                    navTitle={navTitle}
                    navContent={navContent}
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
                    searchClickHandler={() => {
                        setShowSearch(true);
                        if (!isMaxMobileResolution) setLeftNavOpen(false);
                    }}
                />
            </div>
            {isAskDocsPage ? (
                <div
                    className="documentBody"
                    style={{
                        width: calculateDocumentBodyWidth(),
                        display: 'flex',
                        marginLeft: isMaxMobileResolution
                            ? `${leftNavWidth}px`
                            : '0px',
                    }}
                >
                    <AskDocs />
                </div>
            ) : (
                <div
                    className={`documentBody ${
                        isHomePage ? 'doc-home' : 'doc-wrapper-detail'
                    }`}
                    style={{
                        width: calculateDocumentBodyWidth(),
                        marginLeft: isMaxMobileResolution
                            ? `${leftNavWidth}px`
                            : '0px',
                    }}
                >
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
                </div>
            )}
        </>
    );

    const renderPlayGround = () => {
        return <RenderPlayGround location={location} />;
    };

    const getClassName = () => {
        let cName = isDarkMode ? 'dark ' : '';
        if (isPublicSiteOpen) cName += 'withHeaderFooter';
        if (isCustomPage) cName += ' pgHeader';
        return cName;
    };

    return (
        <>
            <Seo title={docTitle} description={docDescription} />
            <div
                id="wrapper"
                data-theme={isDarkMode ? 'dark' : 'light'}
                key={key}
            >
                {isPublicSiteOpen && (
                    <Header
                        location={location}
                        setDarkMode={setDarkMode}
                        isDarkMode={isDarkMode}
                    />
                )}
                <main
                    ref={ref as React.RefObject<HTMLDivElement>}
                    className={getClassName()}
                    style={{
                        height: !docContent && MAIN_HEIGHT_WITHOUT_DOC_CONTENT,
                    }}
                >
                    {isApiPlaygroundPage
                        ? renderPlayGround()
                        : renderDocTemplate()}
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
