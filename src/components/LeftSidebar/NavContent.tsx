import React from 'react';
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
            className={props.leftNavOpen ? 'asideDisplay' : ''}
        >
            {props.backLink && (
                <BackButton
                    title={t('NAV_BACK_BTN_TEXT')}
                    backLink={props.backLink}
                />
            )}

            <div className="searchInputSelector">
                <div className="searchInputWrapper">
                    <div className="searchInputContainer">
                        <IconContext.Provider
                            value={{
                                className: `icon searchIcon`,
                            }}
                        >
                            <BiSearch />
                        </IconContext.Provider>

                        <input
                            data-testid="search-input"
                            type="Search"
                            placeholder={t('SEARCH_PLACEHOLDER')}
                            onClick={() => props.searchClickHandler()}
                            readOnly
                        />
                    </div>
                </div>
            </div>
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
