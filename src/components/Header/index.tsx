import React, { useState, useEffect, useRef } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { IconContext } from '@react-icons/all-files';
import { RiMoonClearLine } from '@react-icons/all-files/ri/RiMoonClearLine';
import { FiSun } from '@react-icons/all-files/fi/FiSun';
import { RiDiscordLine } from '@react-icons/all-files/ri/RiDiscordLine';
import { FiGithub } from '@react-icons/all-files/fi/FiGithub';
import { FiChevronDown } from '@react-icons/all-files/fi/FiChevronDown';
import { FiUsers } from '@react-icons/all-files/fi/FiUsers';
import { FiHelpCircle } from '@react-icons/all-files/fi/FiHelpCircle';
import { FiExternalLink } from '@react-icons/all-files/fi/FiExternalLink';

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
    const [resourcesOpen, setResourcesOpen] = useState(false);
    const resourcesRef = useRef<HTMLDivElement>(null);

    const isMaxMobileResolution = !(width < MAX_MOBILE_RESOLUTION);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
                setResourcesOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleThemeToggle = () => {
        const newDark = !props.isDarkMode;
        props.setDarkMode(newDark);
        localStorage.setItem('theme', newDark ? 'dark' : 'light');
        localStorage.setItem('themeMode', newDark ? 'dark' : 'light');
    };

    const resourceLinks = [
        {
            name: 'Community',
            link: 'https://community.thoughtspot.com/customers/s/topic/0TO3n000000erVyGAI/developers-embedding',
            icon: FiUsers,
        },
        {
            name: 'Support',
            link: 'https://www.thoughtspot.com/support',
            icon: FiHelpCircle,
        },
        {
            name: 'GitHub',
            link: 'https://github.com/thoughtspot/visual-embed-sdk',
            icon: FiGithub,
        },
        {
            name: 'Discord',
            link: 'https://discord.gg/YBWP65W6te',
            icon: RiDiscordLine,
        },
    ];

    return (
        <header>
            <section
                className="containerWrapper"
                ref={ref as React.RefObject<HTMLDivElement>}
            >
                <div className="headerWrapper">
                    {/* Logo — retained as-is */}
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

                    {isMaxMobileResolution && (
                        <nav className="header-nav" aria-label="Primary navigation">
                            {/* Docs link — points to product docs home */}
                            <a
                                href="https://docs.thoughtspot.com/home"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header-nav-link"
                            >
                                Docs
                            </a>

                            {/* Resources dropdown */}
                            <div className="header-dropdown" ref={resourcesRef}>
                                <button
                                    className="header-nav-link header-dropdown-trigger"
                                    onClick={() => setResourcesOpen(!resourcesOpen)}
                                    aria-expanded={resourcesOpen}
                                    aria-haspopup="true"
                                >
                                    Resources
                                    <IconContext.Provider value={{ className: 'header-chevron' }}>
                                        <FiChevronDown />
                                    </IconContext.Provider>
                                </button>
                                {resourcesOpen && (
                                    <div className="header-dropdown-menu" role="menu">
                                        {resourceLinks.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <a
                                                    key={item.name}
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="header-dropdown-item"
                                                    role="menuitem"
                                                    onClick={() => setResourcesOpen(false)}
                                                >
                                                    <IconContext.Provider value={{ className: 'dropdown-item-icon' }}>
                                                        <Icon />
                                                    </IconContext.Provider>
                                                    {item.name}
                                                    <IconContext.Provider value={{ className: 'external-link-icon' }}>
                                                        <FiExternalLink />
                                                    </IconContext.Provider>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </nav>
                    )}

                    <div className="header-right">
                        <Dropdown
                            location={props.location}
                            isMobile={isMaxMobileResolution}
                        />

                        {/* Light / Dark toggle only — Auto applied silently on first load */}
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
