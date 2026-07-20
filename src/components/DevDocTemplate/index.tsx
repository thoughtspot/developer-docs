import React, { useState, useEffect, FC } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import Modal from 'react-modal';
// eslint-disable-next-line import/no-extraneous-dependencies
import { graphql, navigate } from 'gatsby';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useResizeDetector } from 'react-resize-detector';
import algoliasearch from 'algoliasearch';
import _ from 'lodash';
// eslint-disable-next-line import/no-extraneous-dependencies
import { BiSearch } from '@react-icons/all-files/bi/BiSearch';
import { Analytics } from '@vercel/analytics/react';
import { Seo } from '../Seo';
import { queryStringParser, isPublicSite } from '../../utils/app-utils';
import { passThroughHandler, fetchChild } from '../../utils/doc-utils';
import Header from '../Header';
import SecondaryHeader, { DocCategory, CATEGORY_PAGEIDS, CATEGORY_NAV_ID } from '../SecondaryHeader';
import LeftSidebar from '../LeftSidebar';
import Docmap from '../Docmap';
import Document from '../Document';
import Search from '../Search';
import '../../assets/styles/index.scss';
import { getAlgoliaIndex } from '../../configs/algolia-search-config';
import RenderPlayGround from './playGround/RESTAPI';
import GraphQLPlayGround from './playGround/GraphQL';
import { AskDocs } from './askDocs';
import AnnouncementBanner from '../AnnouncementBanner';
import {
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
    HOME_ANNOUNCEMENT_BANNER,
    CUSTOM_PAGE_ID,
    BUILD_ENVS,
    VERSION_DROPDOWN,
} from '../../configs/doc-configs';
import {
    LEFT_NAV_WIDTH_DESKTOP,
    MAX_TABLET_RESOLUTION,
    LEFT_NAV_WIDTH_TABLET,
    MAX_MOBILE_RESOLUTION,
    MAX_CONTENT_WIDTH_DESKTOP,
    MAIN_HEIGHT_WITHOUT_DOC_CONTENT,
} from '../../constants/uiConstants';
import t from '../../utils/lang-utils';
import { getHTMLFromComponent } from '../../utils/react-utils';
import VersionIframe from '../VersionIframe';

// Key of the merged nav-in-product-help.adoc entry in processedNavMap (pageid minus 'nav-' prefix).
// Not a real DocCategory/tab — used only to pick the left sidebar content when embedded in-product.
const IN_PRODUCT_NAV_KEY = 'in-product-help';

const DevDocTemplate: FC<DevDocTemplateProps> = (props) => {
    const {
        data,
        location,
        pageContext: { namePageIdMap, navMap = {} },
    } = props;
    const isBrowser = () => typeof window !== 'undefined';

    const { curPageNode, navNode } = data;

    const isHomePage = curPageNode?.pageAttributes?.pageid === HOME_PAGE_ID;

    const { width, ref } = useResizeDetector();
    const [params, setParams] = useState({
        [TS_HOST_PARAM]: DEFAULT_HOST,
        [TS_ORIGIN_PARAM]: '',
        [TS_PAGE_ID_PARAM]: curPageNode.pageAttributes.pageid,
        [NAV_PREFIX]: process.env.BUILD_ENV === BUILD_ENVS.LOCAL ? '' : '/docs',
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
    // breadcrumsData is derived after processedNavMap is built (see useMemo below)
    const [activeCategory, setActiveCategory] = useState<DocCategory>('guides');
    const [showSearch, setShowSearch] = useState(false);
    const [leftNavOpen, setLeftNavOpen] = useState(false);
    const [keyword, updateKeyword] = useState('');
    const [isPublicSiteOpen, setIsPublicSiteOpen] = useState(() => {
        if (typeof window !== 'undefined') return isPublicSite(location.search);
        return true;
    });
    const [isDarkMode, setDarkMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        // URL param takes highest priority (set by embedding product to pass its theme).
        const urlParams = new URLSearchParams(window.location.search);
        const darkModeParam = urlParams.get('isDarkMode');
        if (darkModeParam !== null) {
            const isDark = darkModeParam === 'true';
            localStorage.setItem('themeMode', isDark ? 'dark' : 'light');
            return isDark;
        }
        // In-product (embedded) presentation always uses light mode — product UI has no theme toggle.
        if (!isPublicSite(location.search)) return false;
        /* themeMode is only written when the user explicitly clicks the toggle.
           If absent, follow OS preference fresh every load. */
        const explicitChoice = localStorage.getItem('themeMode');
        if (explicitChoice) return explicitChoice === 'dark';
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        localStorage.setItem('theme', prefersDark ? 'dark' : 'light');
        return prefersDark;
    });
    const [key, setKey] = useState('');

    // Pre-process all category nav HTMLs once ({{navprefix}} substitution applied to each)
    const processedNavMap = React.useMemo(() =>
        Object.fromEntries(
            Object.entries(navMap as Record<string, string>).map(([cat, html]) => [
                cat,
                passThroughHandler(html, params) || '',
            ]),
        ),
    // navMap is static (from pageContext); params is stable after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

    // Breadcrumb data built from master nav + all category navs for full coverage
    // (excludes the merged in-product nav, which duplicates the category navs)
    const breadcrumsData = React.useMemo(() => {
        if (typeof window === 'undefined') return [];
        const allHtmls = [
            initialNavContentData,
            ...Object.entries(processedNavMap as Record<string, string>)
                .filter(([cat]) => cat !== IN_PRODUCT_NAV_KEY)
                .map(([, html]) => html),
        ];
        return allHtmls.flatMap((html) => fetchChild(html));
    }, [processedNavMap]);

    // Pick the right sidebar content for the active category.
    // In-product (embedded) presentation has no category tabs — always show the merged nav.
    const activeNavContent = React.useMemo(() => {
        if (!isPublicSiteOpen) {
            return processedNavMap[IN_PRODUCT_NAV_KEY] || navContent;
        }
        const navId = CATEGORY_NAV_ID[activeCategory];
        const mapKey = navId.startsWith('nav-') ? navId.slice(4) : null;
        return (mapKey && processedNavMap[mapKey]) || navContent;
    }, [activeCategory, processedNavMap, navContent, isPublicSiteOpen]);

    const isCustomPage = _.values(CUSTOM_PAGE_ID).some(
        (pageId: string) => pageId === params[TS_PAGE_ID_PARAM],
    );
    const isApiPlayground =
        params[TS_PAGE_ID_PARAM] === CUSTOM_PAGE_ID.API_PLAYGROUND;

const isVersionedIframe = VERSION_DROPDOWN.some(
        (version) =>
            props?.pageContext?.iframeUrl &&
            version.iframeUrl === props?.pageContext?.iframeUrl,
    );

    // True when loaded inside a VersionIframe (outer shell sets ?_iframe=1).
    // Outer shell already renders SecondaryHeader, so suppress ours to avoid duplication.
    const isIframeMode =
        typeof window !== 'undefined' &&
        new URLSearchParams(location.search).get('_iframe') === '1';

    const isGQPlayGround =
        params[TS_PAGE_ID_PARAM] === CUSTOM_PAGE_ID.GQ_PLAYGROUND;
    const isPlayGround =
        isGQPlayGround ||
        isApiPlayground ||
        isVersionedIframe;

    const isAskDocsPage = params[TS_PAGE_ID_PARAM] === CUSTOM_PAGE_ID.ASK_DOCS;

    /* Build pageId → category map by parsing hrefs from each category's nav HTML.
     * This means writers only need to update nav-*.adoc — no TypeScript changes needed.
     * Excludes the merged in-product nav, which isn't a real tab/category. */
    const pageIdToCategoryMap = React.useMemo(() => {
        if (typeof window === 'undefined') return {};
        const map: Record<string, DocCategory> = {};
        Object.entries(processedNavMap).forEach(([cat, html]) => {
            if (cat === IN_PRODUCT_NAV_KEY) return;
            const doc = new DOMParser().parseFromString(html as string, 'text/html');
            doc.querySelectorAll('a[href]').forEach((a) => {
                const href = a.getAttribute('href') || '';
                // hrefs are like /docs/pageid or /pageid — extract the last segment
                const pageId = href.split('?')[0].split('/').filter(Boolean).pop();
                if (pageId) map[pageId] = cat as DocCategory;
            });
        });
        return map;
    }, [processedNavMap]);

    /* Detect active category from current page ID */
    useEffect(() => {
        const currentPageId = curPageNode.pageAttributes.pageid;
        // First try the auto-derived map from nav files
        if (pageIdToCategoryMap[currentPageId]) {
            setActiveCategory(pageIdToCategoryMap[currentPageId]);
            return;
        }
        // Fall back to the static CATEGORY_PAGEIDS for any pages not yet in a nav file
        const found = (Object.entries(CATEGORY_PAGEIDS) as [DocCategory, string[]][]).find(
            ([, pageIds]) => pageIds.includes(currentPageId),
        );
        if (found) setActiveCategory(found[0]);
    }, [curPageNode.pageAttributes.pageid, pageIdToCategoryMap]);

    useEffect(() => {
        // based on query params set if public site is open or not
        setIsPublicSiteOpen(isPublicSite(location.search));

        const paramObj = queryStringParser(location.search);
        if (paramObj?.origin && paramObj?.origin !== '')
            localStorage.setItem('origin', paramObj?.origin);

        setParams({ ...paramObj, ...params });
        const { pathname } = location;

        if (isBrowser() && !isPlayGround) {
            localStorage.setItem('prevPath', pathname?.replace('/docs', ''));
        }
    }, [location.search]);

    useEffect(() => {
        if (isBrowser()) {
            // In-product (embedded) presentation always uses light mode.
            if (!isPublicSiteOpen) {
                setDarkMode(false);
                setKey('dark');
                return;
            }
            /* Correct SSR mismatch on first hydration */
            const explicitChoice = localStorage.getItem('themeMode');
            let isDark: boolean;
            if (explicitChoice) {
                isDark = explicitChoice === 'dark';
            } else {
                isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            }
            setDarkMode(isDark);
            setKey('dark');
        }
    }, []);

    // Effect to handle URL parameters for dark mode
    useEffect(() => {
        if (isBrowser()) {
            // Check URL for isDarkMode parameter
            const urlParams = new URLSearchParams(window.location.search);
            const darkModeParam = urlParams.get('isDarkMode');

            if (darkModeParam !== null) {
                // Update dark mode state from URL parameter
                const newDarkMode = darkModeParam === 'true';
                setDarkMode(newDarkMode);
                localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
                localStorage.setItem('themeMode', newDarkMode ? 'dark' : 'light');
            }
        }
    }, [location.search]);

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
        // So that the parent can sync the url
        window.parent.postMessage(
            {
                params: {
                    [TS_HOST_PARAM]: DEFAULT_HOST,
                    [TS_ORIGIN_PARAM]: '',
                    [TS_PAGE_ID_PARAM]: curPageNode.pageAttributes.pageid,
                    [NAV_PREFIX]:
                        process.env.NODE_ENV === BUILD_ENVS.LOCAL
                            ? ''
                            : '/docs',
                    [PREVIEW_PREFIX]: `${DEFAULT_PREVIEW_HOST}/#${DEFAULT_APP_ROOT}`,
                },
                subsection: location.hash.split('#')[1] || '',
            },
            '*',
        );
    }, [location.search, location.hash]);

    // Listen for messages from the iframe
    useEffect(() => {
        const handleMessage = (e) => {
            if (e.data?.params || e.data?.subsection) {
                console.log('Iframe message:', e.data);

                if (e.data?.params?.pageid && typeof window !== 'undefined') {
                    const isVersionedIframeMessage =
                        e.origin &&
                        VERSION_DROPDOWN.some(
                            (version) =>
                                version.iframeUrl &&
                                e.origin.includes(
                                    new URL(version.iframeUrl).hostname,
                                ),
                        );

                    if (!isVersionedIframeMessage) {
                        return;
                    }

                    const url = new URL(window.location.href);

                    // Check if URL has _iframe flag - prevents infinite loops
                    if (url.searchParams.get('_iframe')) {
                        return;
                    }

                    url.searchParams.set('pageid', e.data.params.pageid);
                    const hash = e.data.subsection;
                    if (hash) {
                        url.hash = hash;
                    }
                    window.history.replaceState({}, '', url.toString());
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

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

    const optionSelected = (link: string, sectionId: string) => {
        updateKeyword('');

        let linkToNavigate = `${link}`;

        if (linkToNavigate.startsWith('/docs')) {
            linkToNavigate = linkToNavigate.replace('/docs', '');
        }
        if (sectionId) {
            linkToNavigate = `${linkToNavigate}#${sectionId}`;
        }
        navigate(linkToNavigate);
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

    const shouldShowRightNav = params[TS_PAGE_ID_PARAM] !== HOME_PAGE_ID;
    Modal.setAppElement('#___gatsby');
    const renderSearch = () => {
        const customStyles = {
            overlay: {
                background: 'rgba(50,57,70, 0.9)',
                zIndex: 10,
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
                    />
                </div>
            </Modal>
        );
    };
    const getParentBackButtonLink = () => {
        let path = '';
        if (isBrowser() && !isPublicSiteOpen)
            path = localStorage.getItem('origin') || '';
        return path;
    };
    const renderDocTemplate = () => (
        <>
            {renderSearch()}
            <div className="leftNavContainer">
                <LeftSidebar
                    backLink={getParentBackButtonLink()}
                    navTitle={navTitle}
                    navContent={activeNavContent}
                    docWidth={width}
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
                <div className="documentBody">
                    <AskDocs />
                </div>
            ) : (
                <div
                    className={`documentBody ${
                        isHomePage ? 'doc-home' : 'doc-wrapper-detail'
                    }`}
                >
                    <div className="introWrapper">
                        <div className="documentWrapperContainer">
                            <Document
                                shouldShowRightNav={shouldShowRightNav}
                                pageid={params[TS_PAGE_ID_PARAM]}
                                docTitle={docTitle}
                                docContent={docContent}
                                breadcrumsData={breadcrumsData}
                                isPublicSiteOpen={isPublicSiteOpen}
                                markdownBody={curPageNode.fields?.markdownBody}
                            />
                        </div>
                        {shouldShowRightNav && (
                            <div className="docmapWrapper">
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
        const backLink = isBrowser()
            ? localStorage.getItem('prevPath')
            : '/introduction';
        if (isApiPlayground)
            return (
                <RenderPlayGround
                    location={location}
                    backLink={backLink}
                    isPublisSiteOpen={isPublicSiteOpen}
                    params={params}
                />
            );

if (isVersionedIframe) {
            return (
                <VersionIframe
                    iframeUrl={props.pageContext.iframeUrl}
                    isDarkMode={isDarkMode}
                    location={location}
                />
            );
        }

        return (
            <GraphQLPlayGround
                location={location}
                backLink={backLink}
                isPublisSiteOpen={isPublicSiteOpen}
            />
        );
    };

    const isEmbeddedContext = () => {
        if (!isBrowser()) return false;
        const urlParams = new URLSearchParams(location.search);
        return urlParams.get('context') === 'embedded' || !isPublicSiteOpen;
    };

    const getClassName = () => {
        let cName = isDarkMode ? 'dark ' : '';
        if (isPublicSiteOpen) cName += 'withHeaderFooter';
        if (isCustomPage) cName += ' pgHeader';
        return cName;
    };

    const getWrapperClassName = () => {
        return isEmbeddedContext() ? 'embedded-mode' : '';
    };

    const getCloudLatestVersion = () => {
        const cloudLatest = VERSION_DROPDOWN?.find(
            (v) => v?.subLabel && v.subLabel.toLowerCase().includes('cloud (latest)'),
        );
        return cloudLatest?.label;
    };

    const extractVersionString = (text: string | undefined | null) => {
        if (!text) return undefined;
        // Matches versions like 26.2.0.cl or 10.15.0.cl / 10.10.0.sw
        const match = text.match(/\b\d+\.\d+\.\d+\.(?:cl|sw)\b/i);
        return match?.[0]?.toLowerCase();
    };

    const getVersionFromPath = (pathname?: string) => {
        if (!pathname) return undefined;
        const normalizedPath = pathname.toLowerCase();

        const versionFromOptions = VERSION_DROPDOWN?.find((option) => {
            const link = option?.link?.trim();
            if (!link || link === '') return false;

            const linkPath = link.startsWith('/') ? link : `/${link}`;
            const hyphenPath = link.replace(/\./g, '-');
            const hyphenPathWithSlash = hyphenPath.startsWith('/')
                ? hyphenPath
                : `/${hyphenPath}`;

            return (
                normalizedPath.includes(linkPath.toLowerCase()) ||
                normalizedPath.includes(hyphenPathWithSlash.toLowerCase())
            );
        });

        const optionVersion =
            extractVersionString(versionFromOptions?.label) ||
            extractVersionString(versionFromOptions?.link);
        if (optionVersion) return optionVersion;

        return extractVersionString(normalizedPath.replace(/-/g, '.'));
    };

    const getVersionFromHost = (hostname?: string) => {
        if (!hostname) return undefined;
        return extractVersionString(hostname.replace(/-/g, '.').toLowerCase());
    };

    const getCurrentDocVersion = () =>
        getVersionFromPath(location?.pathname) || getVersionFromHost(location?.hostname);

    const shouldShowAnnouncementBanner = () => {
        if (!isPublicSiteOpen) return false;
        if (!HOME_ANNOUNCEMENT_BANNER?.enabled) return false;

        const cloudLatest = extractVersionString(getCloudLatestVersion());
        const bannerVersion =
            extractVersionString(HOME_ANNOUNCEMENT_BANNER?.linkText) ||
            extractVersionString(HOME_ANNOUNCEMENT_BANNER?.message) ||
            extractVersionString(HOME_ANNOUNCEMENT_BANNER?.linkHref);
        const currentDocVersion = getCurrentDocVersion();

        // Only hide when we can confidently compare and they match.
        if (cloudLatest && bannerVersion && cloudLatest === bannerVersion) return false;
        if (currentDocVersion && bannerVersion && currentDocVersion === bannerVersion) {
            return false;
        }
        return true;
    };

    const isExternalLink = (href?: string) => /^https?:\/\//i.test(href || '');
    const shouldOpenBannerLinkNewTab = (href?: string) =>
        Boolean(HOME_ANNOUNCEMENT_BANNER?.openInNewTab) || isExternalLink(href);
    const bannerLinkOpensInNewTab = shouldOpenBannerLinkNewTab(
        HOME_ANNOUNCEMENT_BANNER?.linkHref,
    );

    const bannerDismissKey = `announcement-${HOME_ANNOUNCEMENT_BANNER?.linkText || 'banner'}`;

    return (
        <>
            <Seo title={docTitle} description={docDescription} />
            <Analytics />
            {shouldShowAnnouncementBanner() && (
                <AnnouncementBanner
                    enabled={HOME_ANNOUNCEMENT_BANNER?.enabled}
                    variant="release"
                    dismissKey={bannerDismissKey}
                    message={
                        <span>
                            {HOME_ANNOUNCEMENT_BANNER?.linkHref &&
                                HOME_ANNOUNCEMENT_BANNER?.linkText && (
                                    <a
                                        className="announcementBanner__link"
                                        href={HOME_ANNOUNCEMENT_BANNER.linkHref}
                                        target={
                                            bannerLinkOpensInNewTab ? '_blank' : undefined
                                        }
                                        rel={
                                            bannerLinkOpensInNewTab
                                                ? 'noopener noreferrer'
                                                : undefined
                                        }
                                    >
                                        {HOME_ANNOUNCEMENT_BANNER.linkText}
                                    </a>
                                )}
                            {(HOME_ANNOUNCEMENT_BANNER?.linkHref &&
                                HOME_ANNOUNCEMENT_BANNER?.linkText) && ' '}
                            {HOME_ANNOUNCEMENT_BANNER?.message ||
                                (VERSION_DROPDOWN?.[0]?.label
                                    ? `Version ${VERSION_DROPDOWN[0].label} is now available!`
                                    : 'A new version is now available!')}
                        </span>
                    }
                />
            )}
            <div
                id="wrapper"
                className={getWrapperClassName()}
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
                <div
                    className="headerPlaceholder"
                    style={
                        isPublicSiteOpen
                            ? { height: '60px' }
                            : { height: '0px' }
                    }
                ></div>
                {!isIframeMode && !isVersionedIframe && (
                    isPublicSiteOpen ? (
                        <SecondaryHeader
                            activeCategory={activeCategory}
                            onCategoryChange={setActiveCategory}
                            location={location}
                            leftNavOpen={leftNavOpen}
                            setLeftNavOpen={setLeftNavOpen}
                        />
                    ) : !isMaxMobileResolution && (
                        // In-product presentation has no tabs — show just the nav
                        // toggle so the sidebar stays reachable on narrow viewports.
                        // Desktop-width embeds skip this entirely; the sidebar is
                        // always visible there.
                        <SecondaryHeader
                            activeCategory={activeCategory}
                            onCategoryChange={setActiveCategory}
                            location={location}
                            leftNavOpen={leftNavOpen}
                            setLeftNavOpen={setLeftNavOpen}
                            minimal
                        />
                    )
                )}
                <main
                    className={getClassName()}
                    ref={ref as React.RefObject<HTMLDivElement>}
                    style={
                        isIframeMode
                            ? { height: '100lvh' }
                            : isVersionedIframe
                                ? { height: 'calc(100lvh - 65px)' }
                                : !isPublicSiteOpen
                                    ? (!isMaxMobileResolution
                                        ? { height: 'calc(100lvh - 48px)' }
                                        : { height: '100lvh' })
                                    : { height: 'calc(100lvh - 65px - 44px)' }
                    }
                >
                    {isPlayGround ? (
                        <div className="playgroundWrapper">
                            {renderPlayGround()}
                        </div>
                    ) : (
                        renderDocTemplate()
                    )}
                </main>
            </div>
        </>
    );
};

export default DevDocTemplate;

export const Head = ({ data }) => {
    return (
        <Seo
            title={
                data.curPageNode.document.title ||
                data.curPageNode.pageAttributes.title
            }
            description={
                data.curPageNode.document.description ||
                data.curPageNode.pageAttributes.description
            }
        ></Seo>
    );
};

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
            fields {
                markdownBody
            }
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
        navMap?: { [key: string]: string };
        iframeUrl?: string;
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
    fields?: {
        markdownBody?: string;
    };
};
