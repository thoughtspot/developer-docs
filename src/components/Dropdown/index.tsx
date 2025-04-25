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
            // If we're in /docs, stay in /docs for the latest version
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

    return (
        <div className="dropdownWrapper">
            <div className="dropdownContainer">
                <div className="dropdown">
                    <button className="dropbtn">
                        {currentVersion?.label}
                        <AiOutlineCaretDown className="arrowDown" />
                    </button>
                    <div className="dropdownContent">
                        {options.map((d) => {
                            return (
                                <div
                                    data-testid={`option-${d?.label}`}
                                    key={d?.link}
                                    onClick={() => handelClick(d)}
                                >
                                    {d?.label}
                                    <div className="subLabel">
                                        <span>{d?.subLabel}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dropdown;
