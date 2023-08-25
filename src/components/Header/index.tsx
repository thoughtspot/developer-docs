import React from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { IconContext } from '@react-icons/all-files';
import { RiMoonClearLine } from '@react-icons/all-files/ri/RiMoonClearLine';
import { FiSun } from '@react-icons/all-files/fi/FiSun';

import TSLogo from '../../assets/svg/ts-logo-white-developer.svg';
import t from '../../utils/lang-utils';
import Dropdown from '../Dropdown';
import References from './references';
import Menu from '../Menu';
import { MAX_MOBILE_RESOLUTION } from '../../constants/uiConstants';
import './index.scss';

const Header = (props: {
    location: Location;
    setDarkMode: Function;
    isDarkMode: boolean;
}) => {
    const { width, ref } = useResizeDetector();

    const isMaxMobileResolution = !(width < MAX_MOBILE_RESOLUTION);

    const headerLinks = [
        {
            name: 'APIs & SDKs',
            link:
                'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/rest/playgroundV2_0',
            external: true,
        },
        {
            name: 'Playground',
            child: [
                {
                    label: 'Visual Embed',
                    link:
                        'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/playground/search',
                    external: true,
                },
                {
                    label: 'REST API',
                    link:
                        'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/rest/playgroundV2_0',
                    external: true,
                },
                {
                    label: 'GraphQL',
                    link:
                        'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/graphql/playground',
                    external: true,
                },
            ],
        },
        {
            name: 'Resources',
            child: [
                {
                    label: 'Community',
                    link:
                        'https://community.thoughtspot.com/customers/s/topic/0TO3n000000erVyGAI/developers-embedding',
                    external: true,
                },
                {
                    label: 'Product documentation',
                    link: 'https://docs.thoughtspot.com',
                    external: true,
                },
                {
                    label: 'Support',
                    link: 'https://www.thoughtspot.com/support',
                    external: true,
                },
            ],
        },
        {
            name: 'On GitHub',
            child: [
                {
                    label: 'Visual Embed SDK',
                    link: 'https://github.com/thoughtspot/visual-embed-sdk',
                    external: true,
                },
                {
                    label: 'REST API SDK',
                    link: 'https://github.com/thoughtspot/rest-api-sdk',
                    external: true,
                },
            ],
        },
    ];

    return (
        <header>
            <section
                className="containerWrapper"
                ref={ref as React.RefObject<HTMLDivElement>}
            >
                <div className="headerWrapper">
                    <div className="header-logo">
                        <h2 className="m-0 d-inline-block logo">
                            <a
                                href="/docs/introduction"
                                title={t('TS_LOGO_ALT_TEXT')}
                            >
                                <img
                                    src={TSLogo}
                                    alt={t('TS_LOGO_ALT_TEXT')}
                                    className="thoughtspotLogo"
                                />
                            </a>
                        </h2>
                    </div>
                    <Menu config={headerLinks} />
                    <div className="theme-version-wrapper">
                        {isMaxMobileResolution && (
                            <div className="themeSwitcher">
                                <IconContext.Provider
                                    value={{ className: 'theme-icon' }}
                                >
                                    {props.isDarkMode ? (
                                        <RiMoonClearLine
                                            onClick={() => {
                                                localStorage.setItem(
                                                    'theme',
                                                    'light',
                                                );
                                                props.setDarkMode(false);
                                            }}
                                        />
                                    ) : (
                                        <FiSun
                                            onClick={() => {
                                                localStorage.setItem(
                                                    'theme',
                                                    'dark',
                                                );
                                                props.setDarkMode(true);
                                            }}
                                        />
                                    )}
                                </IconContext.Provider>
                            </div>
                        )}
                        <Dropdown
                            location={props.location}
                            isMobile={isMaxMobileResolution}
                        />
                    </div>
                    <References />
                </div>
            </section>
        </header>
    );
};

export default Header;