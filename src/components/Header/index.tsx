import React from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { IconContext } from '@react-icons/all-files';
import { RiMoonClearLine } from '@react-icons/all-files/ri/RiMoonClearLine';
import { FiSun } from '@react-icons/all-files/fi/FiSun';
import { RiDiscordLine } from '@react-icons/all-files/ri/RiDiscordLine';
import { FiGithub } from '@react-icons/all-files/fi/FiGithub';

import TSLogo from '../../assets/svg/ts-logo-white-developer.svg';
import t from '../../utils/lang-utils';
import Dropdown from '../Dropdown';
// import References from './references';
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
            name: 'Community',
            link:
                'https://community.thoughtspot.com/customers/s/topic/0TO3n000000erVyGAI/developers-embedding',
            external: true,
        },
        {
            name: 'Support',
            link: 'https://www.thoughtspot.com/support',
            external: true,
        },
        {
            name: 'GitHub',
            link: 'https://github.com/thoughtspot/visual-embed-sdk',
            external: true,
            icon: FiGithub,
        },
        {
            name: 'Discord',
            link: 'https://discord.gg/PPgnx3YZ',
            external: true,
            icon: RiDiscordLine,
        },
        // {
        //     name: 'Product documentation',
        //     link: 'https://docs.thoughtspot.com',
        //     external: true,
        // },
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
                    {/* <References /> */}
                </div>
            </section>
        </header>
    );
};

export default Header;