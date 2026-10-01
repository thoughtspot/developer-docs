import * as React from 'react';
import { Link } from 'gatsby';
import { NOT_FOUND_GO_HOME_PAGE_ID } from '../../configs/doc-configs';
import t from '../../utils/lang-utils';
import './index.scss';

const Page404 = () => {
    return (
        <main className="pageStyles" id="page-404">
            <title>{t('404_PAGE_TITLE')}</title>
            <h1 className="headingStyles">{t('404_PAGE_HEADING')}</h1>
            <p className="paragraphStyles">
                {t('404_PAGE_MSG_PRETEXT')} {t('404_PAGE_MSG')}
            </p>
            <p className="paragraphStyles">
                <Link to={`/?pageid=${NOT_FOUND_GO_HOME_PAGE_ID}`}>
                    {t('404_GO_HOME_LINK_TEXT')}
                </Link>
                .
            </p>
        </main>
    );
};

export default Page404;
