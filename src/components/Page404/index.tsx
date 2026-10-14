import * as React from 'react';
import { Link } from 'gatsby';
import { NOT_FOUND_GO_HOME_PAGE_ID } from '../../configs/doc-configs';
import t from '../../utils/lang-utils';
import { isPublicSite } from '../../utils/app-utils';
import { useRadianceTheme } from '../../utils/radiance';
import notFoundIllustration from '../../assets/svg/not-found-illustration.svg';
import './index.scss';

const Page404 = () => {
    // The page is prerendered once (404.html), so it always starts with the public layout and
    // switches to the in-product one on mount when it is opened inside the product iframe.
    const [isEmbedded, setIsEmbedded] = React.useState(false);
    React.useEffect(() => {
        setIsEmbedded(!isPublicSite(window.location.search));
    }, []);

    // The 404 designs only have a light variant.
    useRadianceTheme(false);

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
            className={`pageStyles${isEmbedded ? ' pageStyles--embedded' : ''}`}
            id="page-404"
        >
            <title>{t('404_PAGE_TITLE')}</title>
            <div className="radianceTop" aria-hidden="true">
                <div
                    className="radiance-local"
                    data-radiance-pattern="top-wash-subtle-dynamic-fast"
                    data-radiance-appearance="light"
                />
            </div>
            {isEmbedded ? (
                <div className="docMissing">
                    <img
                        className="docMissingIllustration"
                        src={notFoundIllustration}
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
