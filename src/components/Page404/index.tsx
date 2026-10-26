import * as React from 'react';
import { Link } from 'gatsby';
import { NOT_FOUND_GO_HOME_PAGE_ID } from '../../configs/doc-configs';
import t from '../../utils/lang-utils';
import { isPublicSite, getInitialDarkMode } from '../../utils/app-utils';
import { useRadianceTheme } from '../../utils/radiance';
import notFoundIllustration from '../../assets/svg/not-found-illustration.svg';
import notFoundIllustrationDark from '../../assets/svg/not-found-illustration-dark.svg';
import '../../assets/styles/radiance-home.css';
import './index.scss';

const Page404 = () => {
    // The page is prerendered once (404.html), so it always starts with the public light layout
    // and switches to the in-product and/or dark presentation on mount.
    const [isEmbedded, setIsEmbedded] = React.useState(false);
    const [isDark, setIsDark] = React.useState(false);
    React.useEffect(() => {
        setIsEmbedded(!isPublicSite(window.location.search));
        setIsDark(getInitialDarkMode(window.location.search));
    }, []);

    // Keeps the Radiance gradient in the same theme as the page.
    useRadianceTheme(isDark);

    const homeLink = (
        <Link
            className="homeButton"
            to={`/?pageid=${NOT_FOUND_GO_HOME_PAGE_ID}`}
        >
            {t('404_GO_HOME_LINK_TEXT')}
        </Link>
    );

    return (
        <main
            className={`pageStyles radiance-home-stage${isEmbedded ? ' pageStyles--embedded' : ''}${isDark ? ' pageStyles--dark' : ''}`}
            id="page-404"
        >
            <title>{t('404_PAGE_TITLE')}</title>
            {/* Radiance "home" product pattern: the same gradient as the product home page and the
                docs home hero. Markup follows products/home/README.md; the recipe CSS owns the look. */}
            <div className="radianceHero" aria-hidden="true">
                <div className="radiance-home">
                    <div
                        className="radiance-local"
                        data-radiance-pattern="home"
                        data-radiance-appearance="light"
                    />
                </div>
            </div>
            {isEmbedded ? (
                <div className="docMissing">
                    <img
                        className="docMissingIllustration"
                        src={isDark ? notFoundIllustrationDark : notFoundIllustration}
                        alt=""
                    />
                    <div className="docMissingText">
                        <h1 className="headingStyles">{t('404_DOC_HEADING')}</h1>
                        <p className="paragraphStyles">{t('404_DOC_MSG')}</p>
                        {homeLink}
                    </div>
                </div>
            ) : (
                <div className="pageMissing">
                    <p className="codeStyles" aria-hidden="true">
                        {t('404_PAGE_CODE')}
                    </p>
                    <h1 className="headingStyles">{t('404_PAGE_HEADING')}</h1>
                    <p className="paragraphStyles">
                        {t('404_PAGE_MSG')}
                        <br />
                        {t('404_PAGE_MSG_DETAIL')}
                    </p>
                    {homeLink}
                </div>
            )}
        </main>
    );
};

export default Page404;
