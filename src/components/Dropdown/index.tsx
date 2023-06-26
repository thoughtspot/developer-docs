import React, { useState, useEffect } from 'react';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import { VERSION_DROPDOWN, TS_Version } from '../../configs/doc-configs';

import './index.scss';

const Dropdown = (props: { location: Location; isMobile: Boolean }) => {
    const { location } = props;
    const options = VERSION_DROPDOWN;
    const [currentVersion, setCurrentVersion] = useState({});

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const version =
            params.get('version') || localStorage.getItem('version');
        const selectedOption =
            options.find(({ link }) => {
                return link.includes(version);
            }) || options[0];
        if (selectedOption) setCurrentVersion(selectedOption);
    }, []);

    const handelClick = (link: string) => {
        const params = new URLSearchParams(location.search);
        params.set('version', link);
        const url =
            location.origin + location?.pathname + '?' + params.toString();
        localStorage.setItem('version', link);
        window.open(url, '_self');
    };

    if (!currentVersion?.link) {
        return <div />;
    }

    return (
        <div className="dropdownWrapper">
            <div className="dropdownContainer">
                <div className="dropdown">
                    <button className="dropbtn">
                        {currentVersion?.label}
                        <AiOutlineCaretDown className="arrowDown" />
                    </button>
                    <div className="dropdownContent">
                        {options.map(({ label, link, subLabel }) => {
                            return (
                                <div
                                    data-testid={`option-${label}`}
                                    key={link}
                                    onClick={() => handelClick(link)}
                                >
                                    {label}
                                    <div className="subLabel">
                                        <span>{subLabel}</span>
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