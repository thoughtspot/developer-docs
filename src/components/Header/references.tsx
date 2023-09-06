import React from 'react';
import { IconContext } from '@react-icons/all-files';
import { RiDiscordLine } from '@react-icons/all-files/ri/RiDiscordLine';
import { FiGithub } from '@react-icons/all-files/fi/FiGithub';

import './index.scss';

const References = () => {
    const getIcon = ({ link, icon }) => {
        const Icon = icon;
        return (
            <div className="icon-item">
                <IconContext.Provider value={{ className: 'icon imgOpacity' }}>
                    <Icon
                        onClick={() => {
                            window.open(link, '_blank');
                        }}
                    />
                </IconContext.Provider>
            </div>
        );
    };

    const links = [
        { link: 'https://discord.gg/PPgnx3YZ', icon: RiDiscordLine },
        {
            link: 'https://github.com/thoughtspot/visual-embed-sdk',
            icon: FiGithub,
        },
    ];

    return <div className="references">{links.map((d) => getIcon(d))}</div>;
};

export default References;
