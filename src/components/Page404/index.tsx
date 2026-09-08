import * as React from 'react';
import { Link } from 'gatsby';
import { NOT_FOUND_GO_HOME_PAGE_ID } from '../../configs/doc-configs';
import t from '../../utils/lang-utils';
import './index.scss';

// This page isn't wrapped by DevDocTemplate (no #wrapper/#docsModal ancestor),
// so it has no theme of its own by default — read the same signals
// DevDocTemplate uses (URL param, explicit stored choice, OS preference) and
// apply data-theme locally.
const getIsDarkMode = () => {
    if (typeof window === 'undefined') return false;
    const darkModeParam = new URLSearchParams(window.location.search).get('isDarkMode');
    if (darkModeParam !== null) return darkModeParam === 'true';
    const explicitChoice = localStorage.getItem('themeMode');
    if (explicitChoice) return explicitChoice === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

const Page404 = () => {
    const [isDarkMode] = React.useState(getIsDarkMode);

    return (
        <main className="pageStyles" id="page-404" data-theme={isDarkMode ? 'dark' : 'light'}>
            <title>{t('404_PAGE_TITLE')}</title>
            <div className="errorCodeStyles">404</div>
            <h1 className="headingStyles">{t('404_PAGE_HEADING')}</h1>
            <p className="paragraphStyles">
                {t('404_PAGE_MSG_PRETEXT')} {t('404_PAGE_MSG')}
            </p>
            <p className="paragraphStyles">
                <button type="button" className="backLinkStyles" onClick={() => window.history.back()}>
                    ← {t('404_GO_BACK_LINK_TEXT')}
                </button>
                {' or '}
                <Link to={`/?pageid=${NOT_FOUND_GO_HOME_PAGE_ID}`}>
                    {t('404_GO_HOME_LINK_TEXT')}
                </Link>
                .
            </p>
        </main>
    );
};

export default Page404;
