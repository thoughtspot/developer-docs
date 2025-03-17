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
        if (
            currentPath === '/' ||
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

        const versionFromPath = options.find(
            (option) =>
                option.link !== ' ' &&
                option.link !== '' &&
                currentPath.includes(option.link),
        );

        if (versionFromPath) {
            setCurrentVersion(versionFromPath);
            return;
        }

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

        localStorage.setItem('version', label);

                if (link === ' ' || link === '') {
            window?.location?.assign('/');
            return;
        }

        if (iframeUrl && link !== ' ') {
            window?.location?.assign(link);
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
