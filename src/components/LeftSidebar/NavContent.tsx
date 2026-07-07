import React from 'react';
import { navigate } from 'gatsby';
import { IconContext } from '@react-icons/all-files';
import { BiSearch } from '@react-icons/all-files/bi/BiSearch';
import BackButton from '../BackButton';
import t from '../../utils/lang-utils';

const NavContent = (props: {
    refObj: React.RefObject<HTMLDivElement>;
    backLink: string;
    navTitle: string;
    leftNavOpen: boolean;
    navContent: string;
    isPublicSiteOpen: boolean;
    isMaxMobileResolution: boolean;
    isDarkMode: boolean;
    setDarkMode: Function;
    searchClickHandler: Function;
}) => {
    return (
        <aside
            ref={props.refObj}
            className={props.leftNavOpen ? 'aside asideDisplay' : 'aside'}
            key={'aside'}
        >
            {props.backLink && (
                <BackButton
                    title={t('NAV_BACK_BTN_TEXT')}
                    backLink={props.backLink}
                />
            )}

            <div className="searchInputLeftNav">
                <div className="searchInputWrapper">
                    <div className="searchInputContainer">
                        <IconContext.Provider
                            value={{
                                className: `icon searchIconSmall`,
                            }}
                        >
                            <BiSearch />
                        </IconContext.Provider>

                        <input
                            data-testid="search-input"
                            type="text"
                            placeholder={t('SEARCH_PLACEHOLDER')}
                            onClick={() => props.searchClickHandler()}
                            readOnly
                        />
                    </div>
                </div>
            </div>
            {/* AskDocs lives in the top SecondaryHeader on the standalone site;
                that bar is hidden in-product, so surface it here instead. */}
            {!props.isPublicSiteOpen && (
                <div className="leftNav-askdocs-wrapper">
                    <button
                        type="button"
                        className="leftNav-askdocs"
                        onClick={() => navigate('/ask-docs')}
                    >
                        AskDocs <span className="leftNav-askdocs__beta">Beta</span>
                    </button>
                </div>
            )}
            <nav>
                <h2 className="heading">{props.navTitle}</h2>
                <div
                    className={`navWrapper ${
                        props.isPublicSiteOpen ? 'withHeaderFooter' : ''
                    }`}
                    dangerouslySetInnerHTML={{
                        __html: props.navContent,
                    }}
                />
            </nav>
        </aside>
    );
};

export default NavContent;
