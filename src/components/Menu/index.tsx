import React, { useState, useEffect } from 'react';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import './index.scss';

const Menu = (props: { config: {} }) => {
    const { config = [] } = props;
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
            {config?.map((c) => (
                <div className="menu">
                    <button
                        className="menubtn"
                        onClick={() => (c.link ? handelClick(c) : null)}
                    >
                        {c.name}
                    </button>
                    {c?.child ? (
                        <div className="menuContent">
                            {c?.child?.map(
                                (d: { label: string; link: string }) => {
                                    return (
                                        <div
                                            data-testid={`menu-${d?.label}`}
                                            onClick={() => handelClick(d)}
                                        >
                                            {d?.label}
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
};

export default Menu;
