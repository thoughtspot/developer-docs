import 'url-search-params-polyfill';
import {
    NAV_PREFIX,
    PREVIEW_PREFIX,
    TS_HOST_PARAM,
    TS_ORIGIN_PARAM,
    TS_APP_ROOT_PARAM,
    TS_PAGE_ID_PARAM,
    DEFAULT_HOST,
    DEFAULT_PREVIEW_HOST,
    DEFAULT_APP_ROOT,
} from '../configs/doc-configs';

/**
 * Parse query string into json object. (Polyfill by 'url-search-params-polyfill' npm package)
 * @param {string} queryParamStr - query string from location.search
 * @returns {object} which contains query params 'key: value' pairs
 */
export const queryStringParser = (queryParamStr: string) => {
    const queryParamObj: { [key: string]: string } = {};

    const entries = new URLSearchParams(queryParamStr).entries();
    let navPrefix = '';
    let tsHostUrl = DEFAULT_PREVIEW_HOST;

    for (const [key, value] of entries) {
        queryParamObj[key] = value;
        if (key === TS_HOST_PARAM) {
            navPrefix += `${TS_HOST_PARAM}=${value}&`;
        }
        if (key === TS_ORIGIN_PARAM) {
            if (value) {
                navPrefix += `${TS_ORIGIN_PARAM}=${encodeURIComponent(value)}&`;
                tsHostUrl = removeTrailingSlash(value.split('#')[0]);
            }
        }
        if (key === TS_APP_ROOT_PARAM) {
            navPrefix += `${TS_APP_ROOT_PARAM}=${value}&`;
        }
    }

    // check required params and add default if value is not available
    queryParamObj[TS_HOST_PARAM] = removeTrailingSlash(
        queryParamObj[TS_HOST_PARAM] || DEFAULT_HOST,
    );
    queryParamObj[TS_APP_ROOT_PARAM] = removeTrailingSlash(
        queryParamObj[TS_APP_ROOT_PARAM] || DEFAULT_APP_ROOT,
    );

    // prepare and set 'Main Navigation' links URL prefix
    // navPrefix += TS_PAGE_ID_PARAM;
    // when using the / based system we dont need to prefix with pageid
    queryParamObj[NAV_PREFIX] = navPrefix;

    // prepare and set 'Preview in Playground' button URL prefix
    queryParamObj[
        PREVIEW_PREFIX
    ] = `${tsHostUrl}/#${queryParamObj[TS_APP_ROOT_PARAM]}`;

    return queryParamObj;
};

export const removeTrailingSlash = (url: string) => {
    return url.replace(/\/$/, '');
};

/**
 * True for any tutorials-module page (/tutorials/... locally, /docs/tutorials/...
 * in production) — path-segment check so it's robust to the {{navprefix}} prefix.
 * Tutorials pages have their own pagination footer and no SpotterCode assistant
 * (see FloatingAssistant), so SpotterCode-related affordances elsewhere (e.g. the
 * "Ask SpotterCode" code-block CTA in Document/helper.tsx) should stay hidden there too.
 * @param {string} pathname - location.pathname
 * @returns {boolean} true if the path is under /tutorials/
 */
export const isTutorialsPath = (pathname: string) => {
    return pathname.split('/').filter(Boolean).includes('tutorials');
};

/**
 * Used to check if the docs portal open as public site or inside embed iframe
 * @param {string} queryParamStr - query string from location.search
 * @returns {boolean} true, if it is opened as public site otherwise false
 */
export const isPublicSite = (queryParamStr: string) => {
    const entries = new URLSearchParams(queryParamStr).entries();
    for (const [key, value] of entries) {
        if ([TS_HOST_PARAM, TS_ORIGIN_PARAM, TS_APP_ROOT_PARAM].includes(key)) {
            return false;
        }
    }

    if (typeof window === 'undefined') {
        return true;
    }
    try {
        return window.self === window.top;
    } catch (e) {
        return false;
    }
};

/**
 * Whether the page should render in dark mode, resolved the same way the main docs template does
 * for a fresh load: the isDarkMode URL param (set by the embedding product) wins, then the
 * explicitly stored choice; with neither, the public site follows the OS preference and
 * in-product stays light.
 * @param {string} queryParamStr - query string from location.search
 * @returns {boolean} true when dark mode applies
 */
export const getInitialDarkMode = (queryParamStr: string) => {
    if (typeof window === 'undefined') return false;
    const param = new URLSearchParams(queryParamStr).get('isDarkMode');
    if (param !== null) return param === 'true';
    try {
        const stored = window.localStorage.getItem('themeMode');
        if (stored) return stored === 'dark';
    } catch (e) {
        // storage unavailable: fall through to the defaults below
    }
    if (!isPublicSite(queryParamStr)) return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export default queryStringParser;
