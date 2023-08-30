import React, { useState, useEffect } from 'react';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import { VERSION_DROPDOWN, TS_Version } from '../../configs/doc-configs';

import './index.scss';

const Dropdown = (props: { location: Location; isMobile: boolean }) => {
    const { location } = props;
    const options = VERSION_DROPDOWN;
    const [currentVersion, setCurrentVersion] = useState({});

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const version =
            params.get('version') || localStorage.getItem('version');
        const selectedOption =
            options.find(({ label }) => {
                return label === version;
            }) || options[0];
        if (selectedOption) setCurrentVersion(selectedOption);
    }, []);

    const handelClick = ({ label, link }) => {
        // const params = new URLSearchParams(location.search);
        // params.set('version', label);

        localStorage.setItem('version', label);
        window?.location?.replace(link);
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
