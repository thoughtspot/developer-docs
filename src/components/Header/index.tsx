import React, { useState, useEffect, useRef } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { IconContext } from '@react-icons/all-files';
import { RiMoonClearLine } from '@react-icons/all-files/ri/RiMoonClearLine';
import { FiSun } from '@react-icons/all-files/fi/FiSun';
import { RiDiscordLine } from '@react-icons/all-files/ri/RiDiscordLine';
import { FiGithub } from '@react-icons/all-files/fi/FiGithub';
import { FiMoreVertical } from '@react-icons/all-files/fi/FiMoreVertical';
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
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    const isMaxMobileResolution = !(width < MAX_MOBILE_RESOLUTION);

    const handleThemeToggle = () => {
        const newDark = !props.isDarkMode;
        props.setDarkMode(newDark);
        localStorage.setItem('theme', newDark ? 'dark' : 'light');
        localStorage.setItem('themeMode', newDark ? 'dark' : 'light');
    };

    useEffect(() => {
        if (!moreOpen) return;
        const handler = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [moreOpen]);

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

    const renderDropdownItems = (
        items: { name: string; sub: string; link: string; icon: any }[],
        onClose?: () => void,
    ) =>
        items.map((item) => {
            const Icon = item.icon;
            return (
                <a
                    key={item.name}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-dropdown-item"
                    role="menuitem"
                    onClick={onClose}
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
        });

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

                    <div className="header-right">
                        {/* Version dropdown */}
                        <Dropdown
                            location={props.location}
                            isMobile={isMaxMobileResolution}
                        />

                        {/* Desktop: Resources hover dropdown + GitHub link */}
                        <div className="header-desktop-nav">
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
                                            {renderDropdownItems(learnLinks)}
                                        </div>
                                        <div className="header-dropdown-col-divider" />
                                        <div className="header-dropdown-section">
                                            <div className="header-dropdown-section-label">Connect</div>
                                            {renderDropdownItems(connectLinks)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <a
                                href="https://github.com/orgs/thoughtspot/repositories"
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
                        </div>

                        {/* Mobile: ⋮ click dropdown with Resources + GitHub */}
                        <div className="header-more-dropdown" ref={moreRef}>
                            <button
                                className="header-nav-link header-more-btn"
                                onClick={() => setMoreOpen((o) => !o)}
                                aria-label="More resources"
                                aria-expanded={moreOpen}
                                aria-haspopup="true"
                            >
                                <IconContext.Provider value={{ className: 'header-more-icon' }}>
                                    <FiMoreVertical />
                                </IconContext.Provider>
                            </button>
                            {moreOpen && (
                                <div className="header-more-panel" role="menu">
                                    <div className="header-dropdown-section">
                                        <div className="header-dropdown-section-label">Learn</div>
                                        {renderDropdownItems(learnLinks, () => setMoreOpen(false))}
                                    </div>
                                    <div className="header-dropdown-col-divider" />
                                    <div className="header-dropdown-section">
                                        <div className="header-dropdown-section-label">Connect</div>
                                        {renderDropdownItems(connectLinks, () => setMoreOpen(false))}
                                    </div>
                                    <div className="header-dropdown-col-divider" />
                                    <div className="header-dropdown-section">
                                        <div className="header-dropdown-section-label">Code</div>
                                        <a
                                            href="https://github.com/orgs/thoughtspot/repositories"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="header-dropdown-item"
                                            role="menuitem"
                                            onClick={() => setMoreOpen(false)}
                                        >
                                            <IconContext.Provider value={{ className: 'dropdown-item-icon' }}>
                                                <FiGithub />
                                            </IconContext.Provider>
                                            <span className="dropdown-item-text">
                                                <span className="dropdown-item-name">GitHub</span>
                                                <span className="dropdown-item-sub">Visual Embed SDK on GitHub</span>
                                            </span>
                                            <IconContext.Provider value={{ className: 'external-link-icon' }}>
                                                <FiExternalLink />
                                            </IconContext.Provider>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Theme toggle — always visible */}
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
                    </div>
                </div>
            </section>
        </header>
    );
};

export default Header;
