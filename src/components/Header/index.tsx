import React from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { IconContext } from '@react-icons/all-files';
import { RiMoonClearLine } from '@react-icons/all-files/ri/RiMoonClearLine';
import { FiSun } from '@react-icons/all-files/fi/FiSun';
import { RiDiscordLine } from '@react-icons/all-files/ri/RiDiscordLine';
import { FiGithub } from '@react-icons/all-files/fi/FiGithub';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import { FiUsers } from '@react-icons/all-files/fi/FiUsers';
import { FiHelpCircle } from '@react-icons/all-files/fi/FiHelpCircle';
import { FiExternalLink } from '@react-icons/all-files/fi/FiExternalLink';
import { FiBook } from '@react-icons/all-files/fi/FiBook';
import { FiBookOpen } from '@react-icons/all-files/fi/FiBookOpen';

import TSLogo from '../../assets/svg/ts-logo-white-developer.svg';
import t from '../../utils/lang-utils';
import Dropdown from '../Dropdown';
import { MAX_MOBILE_RESOLUTION } from '../../constants/uiConstants';
import './index.scss';

const Header = (props: {
    location: Location;
    setDarkMode: Function;
    isDarkMode: boolean;
}) => {
    const { width, ref } = useResizeDetector();

    const isMaxMobileResolution = !(width < MAX_MOBILE_RESOLUTION);

    const handleThemeToggle = () => {
        const newDark = !props.isDarkMode;
        props.setDarkMode(newDark);
        localStorage.setItem('theme', newDark ? 'dark' : 'light');
        localStorage.setItem('themeMode', newDark ? 'dark' : 'light');
    };

    const learnLinks = [
        {
            name: 'Docs',
            sub: 'ThoughtSpot Analytics product documentation',
            link: 'https://docs.thoughtspot.com/home',
            icon: FiBook,
        },
        {
            name: 'Training',
            sub: 'ThoughtSpot Embedded learning paths',
            link: 'https://training.thoughtspot.com/path/thoughtspot-embedded',
            icon: FiBookOpen,
        },
    ];

    const connectLinks = [
        {
            name: 'Discord',
            sub: 'Chat with the dev community',
            link: 'https://discord.gg/YBWP65W6te',
            icon: RiDiscordLine,
        },
        {
            name: 'Community',
            sub: 'Connect with other developers',
            link: 'https://community.thoughtspot.com/customers/s/topic/0TO3n000000erVyGAI/developers-embedding',
            icon: FiUsers,
        },
        {
            name: 'Support',
            sub: 'Get help from ThoughtSpot',
            link: 'https://www.thoughtspot.com/support',
            icon: FiHelpCircle,
        },
    ];

    return (
        <header>
            <section
                className="containerWrapper"
                ref={ref as React.RefObject<HTMLDivElement>}
            >
                <div className="headerWrapper">
                    {/* Logo */}
                    <div className="header-logo">
                        <h2 className="m-0 d-inline-block logo">
                            <a
                                href="/docs/introduction"
                                title={t('TS_LOGO_ALT_TEXT')}
                                className="logo-link"
                            >
                                <img
                                    src={TSLogo}
                                    alt={t('TS_LOGO_ALT_TEXT')}
                                    className="thoughtspotLogo"
                                />
                            </a>
                        </h2>
                    </div>


                    {/* Right side: Version |  Resources | GitHub | Toggle */}
                    <div className="header-right">
                        {/* Version dropdown */}
                        <Dropdown
                            location={props.location}
                            isMobile={isMaxMobileResolution}
                        />

                        {/* Resources — hover-driven (CSS), consistent with Version dropdown */}
                        {isMaxMobileResolution && (
                            <div className="header-dropdown">
                                <button className="header-nav-link header-dropdown-trigger">
                                    Resources
                                    <IconContext.Provider value={{ className: 'header-chevron' }}>
                                        <AiOutlineCaretDown />
                                    </IconContext.Provider>
                                </button>
                                <div className="header-dropdown-menu">
                                    <div className="header-dropdown-menu-panel" role="menu">
                                        <div className="header-dropdown-section">
                                            <div className="header-dropdown-section-label">Learn</div>
                                            {learnLinks.map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                    <a
                                                        key={item.name}
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="header-dropdown-item"
                                                        role="menuitem"
                                                    >
                                                        <IconContext.Provider value={{ className: 'dropdown-item-icon' }}>
                                                            <Icon />
                                                        </IconContext.Provider>
                                                        <span className="dropdown-item-text">
                                                            <span className="dropdown-item-name">{item.name}</span>
                                                            <span className="dropdown-item-sub">{item.sub}</span>
                                                        </span>
                                                        <IconContext.Provider value={{ className: 'external-link-icon' }}>
                                                            <FiExternalLink />
                                                        </IconContext.Provider>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                        <div className="header-dropdown-col-divider" />
                                        <div className="header-dropdown-section">
                                            <div className="header-dropdown-section-label">Connect</div>
                                            {connectLinks.map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                    <a
                                                        key={item.name}
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="header-dropdown-item"
                                                        role="menuitem"
                                                    >
                                                        <IconContext.Provider value={{ className: 'dropdown-item-icon' }}>
                                                            <Icon />
                                                        </IconContext.Provider>
                                                        <span className="dropdown-item-text">
                                                            <span className="dropdown-item-name">{item.name}</span>
                                                            <span className="dropdown-item-sub">{item.sub}</span>
                                                        </span>
                                                        <IconContext.Provider value={{ className: 'external-link-icon' }}>
                                                            <FiExternalLink />
                                                        </IconContext.Provider>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* GitHub nav link */}
                        {isMaxMobileResolution && (
                            <a
                                href="https://github.com/thoughtspot/visual-embed-sdk"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header-nav-link"
                                title="Visual Embed SDK on GitHub"
                            >
                                <IconContext.Provider value={{ className: 'header-nav-icon' }}>
                                    <FiGithub />
                                </IconContext.Provider>
                                GitHub
                            </a>
                        )}


                        {/* Theme toggle */}
                        {isMaxMobileResolution && (
                            <button
                                className="theme-toggle-btn"
                                onClick={handleThemeToggle}
                                aria-label={props.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                                title={props.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                <IconContext.Provider value={{ className: 'theme-icon' }}>
                                    {props.isDarkMode ? <RiMoonClearLine /> : <FiSun />}
                                </IconContext.Provider>
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </header>
    );
};

export default Header;
