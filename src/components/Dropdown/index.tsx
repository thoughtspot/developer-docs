import React, { useState, useEffect } from 'react';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import { VERSION_DROPDOWN } from '../../configs/doc-configs';

import './index.scss';

interface VersionOption {
    label: string;
    link: string;
    subLabel: string;
    iframeUrl?: string;
}

const Dropdown = (props: { location: Location; isMobile: boolean }) => {
    const { location } = props;
    const options = VERSION_DROPDOWN;
    const [currentVersion, setCurrentVersion] = useState(options[0]);

    useEffect(() => {
        const currentPath = location.pathname;

        // First check if we're on a versioned path
        const versionFromPath = options.find(
            (option) =>
                option.link !== ' ' &&
                option.link !== '' &&
                (currentPath.includes(`/${option.link}`) ||
                    currentPath.includes(
                        `/${option.link.replace(/\./g, '-')}`,
                    )),
        );

        if (versionFromPath) {
            setCurrentVersion(versionFromPath);
            return;
        }

        // Check for latest version paths
        if (
            currentPath === '/' ||
            currentPath === '/docs' ||
            currentPath === '/docs/' ||
            currentPath.startsWith('/introduction') ||
            !currentPath.includes('-')
        ) {
            const latestVersion = options.find(
                (option) => option.link === ' ' || option.link === '',
            );
            if (latestVersion) {
                setCurrentVersion(latestVersion);
                return;
            }
        }

        // Check in /docs/ path
        if (currentPath.startsWith('/docs/')) {
            const pathParts = currentPath.split('/');
            if (pathParts.length >= 3) {
                const versionPathInDocs = pathParts.slice(2).join('/');
                const matchingVersion = options.find((option) => {
                    if (option.link === ' ' || option.link === '') {
                        return false;
                    }
                    const optionPath = option.link.startsWith('/')
                        ? option.link.substring(1)
                        : option.link;
                    return (
                        optionPath === versionPathInDocs ||
                        optionPath.replace(/\./g, '-') === versionPathInDocs
                    );
                });
                if (matchingVersion) {
                    setCurrentVersion(matchingVersion);
                    return;
                }
            }
        }

        // Fallback to query params or localStorage
        const params = new URLSearchParams(location.search);
        const version =
            params.get('version') || localStorage.getItem('version');
        const selectedOption =
            options.find(({ label }) => {
                return label === version;
            }) || options[0];
        if (selectedOption) setCurrentVersion(selectedOption);
    }, [location.pathname]);

    const handelClick = (option: VersionOption) => {
        const { label, link, iframeUrl } = option;
        const currentPath = location.pathname;

        localStorage.setItem('version', label);

        // Handle latest version (empty or space link)
        if (link === ' ' || link === '') {
            if (currentPath.startsWith('/docs')) {
                window?.location?.assign('/docs');
            } else {
                window?.location?.assign('/');
            }
            return;
        }

        if (iframeUrl) {
            const versionPath = link.startsWith('/') ? link.substring(1) : link;
            const targetUrl = currentPath.startsWith('/docs')
                ? `/docs/${versionPath}`
                : `/${versionPath}`;

            window?.location?.assign(targetUrl);
        } else {
            window?.location?.replace(link);
        }
    };

    const cloudVersions = options.filter((o) => o.label.endsWith('.cl'));
    const swVersions = options.filter((o) => o.label.endsWith('.sw'));

    const renderVersionItem = (d: VersionOption) => {
        const isActive = d.label === currentVersion?.label;
        return (
            <div
                key={d.link}
                data-testid={`option-${d.label}`}
                className={`version-item${isActive ? ' active' : ''}`}
                onClick={() => handelClick(d)}
            >
                <span className="version-item-label">{d.label}</span>
                {d.subLabel && (
                    <span className="version-item-sub">{d.subLabel}</span>
                )}
            </div>
        );
    };

    return (
        <div className="dropdownWrapper">
            <div className="dropdownContainer">
                <div className="dropdown">
                    <button className="dropbtn">
                        {currentVersion?.label}
                        <AiOutlineCaretDown className="arrowDown" />
                    </button>
                    <div className="dropdownContent">
                        <div className="version-panel">
                            <div className="version-section">
                                <div className="version-section-label">Cloud</div>
                                {cloudVersions.map(renderVersionItem)}
                            </div>
                            {swVersions.length > 0 && (
                                <>
                                    <div className="version-col-divider" />
                                    <div className="version-section">
                                        <div className="version-section-label">Software</div>
                                        {swVersions.map(renderVersionItem)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dropdown;
