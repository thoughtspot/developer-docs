import React, { useState, useEffect } from 'react';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import './index.scss';

const Menu = (props: { config: {} }) => {
    const { config } = props;
    const handelClick = (menu: { link: string; external: boolean }) => {
        const { external = false, link } = menu;
        let url = location.origin + '/' + link;
        let target = '_self';
        if (external) {
            url = link;
            target = '_blank';
        }
        window.open(url, target);
    };

    return (
        <div className="d-inline-block headerLink menuWrapper">
            {config.map(({ name, child }) => (
                <div className="menu">
                    <button className="menubtn">{name}</button>
                    <div className="menuContent">
                        {child?.map((d: { label: string; link: string }) => {
                            return (
                                <div
                                    data-testid={`option-${d?.label}`}
                                    onClick={() => handelClick(d)}
                                >
                                    {d?.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Menu;
