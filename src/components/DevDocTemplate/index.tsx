import React, { useState, useEffect, FC } from 'react';
import Modal from 'react-modal';
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
import RenderPlayGround from './renderPlayGround';
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

    const isAPIPlayGround =
        CUSTOM_PAGE_ID.API_PLAYGROUND === params[TS_PAGE_ID_PARAM];

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
    Modal.setAppElement('#___gatsby');
    const renderSearch = () => {
        const customStyles = {
            content: {
                top: '50px',
                left: 'auro',
                right: 'auto',
                bottom: 'auto',
                width: '40%',
                margin: 'auto',
                transform: 'translate(80%, 70px)',
                border: 'none',
                height: '200px',
                boxShadow: 'none',
                background: 'transparent',
            },
        };
        return (
            <Modal
                isOpen={showSearch}
                onRequestClose={() => setShowSearch(false)}
                style={customStyles}
            >
                <Search
                    keyword={keyword}
                    onChange={(e: React.FormEvent<HTMLInputElement>) =>
                        updateKeyword((e.target as HTMLInputElement).value)
                    }
                    options={results}
                    optionSelected={optionSelected}
                    leftNavOpen={true}
                    updateKeyword={updateKeyword}
                    isMaxMobileResolution={isMaxMobileResolution}
                    setDarkMode={setDarkMode}
                    isDarkMode={isDarkMode}
                    isPublicSiteOpen={isPublicSiteOpen}
                    leftNavWidth={leftNavWidth}
                    backLink={backLink}
                />
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
                        console.log('update', showSearch);
                    }}
                />
            </div>
            <div
                className="documentBody"
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
        </>
    );
    const renderPlayGround = () => <RenderPlayGround location={location} />;

    const getClassName = () => {
        let cName = isDarkMode ? 'dark ' : '';
        if (isPublicSiteOpen) cName += 'withHeaderFooter';
        if (isAPIPlayGround) cName += ' pgHeader';
        return cName;
    };

    return (
        <>
            <Seo title={docTitle} description={docDescription} />
            <div id="wrapper" data-theme={isDarkMode ? 'dark' : 'light'}>
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
                    {isAPIPlayGround ? renderPlayGround() : renderDocTemplate()}
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
