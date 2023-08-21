import React from 'react';
import { navigate } from 'gatsby';

import { IconContext } from '@react-icons/all-files';
import { BsArrowLeft } from '@react-icons/all-files/bs/BsArrowLeft';
import './index.scss';

const BackButton = (props: {
    title: string;
    backLink: string;
    customStyles?: Object;
    internalRedirect?: Boolean;
}) => {
    const { internalRedirect = false, backLink } = props;

    const clickHandler = () => {
        if (internalRedirect) navigate(backLink, { replace: true });
    };

    return (
        <div
            data-testid="backBtn"
            className="backButtonWrapper"
            style={props?.customStyles ?? {}}
        >
            <button onClick={clickHandler}>
                <a href={!internalRedirect ? backLink : '#'} target="_parent">
                    <IconContext.Provider
                        value={{ className: 'icon leftIcon' }}
                    >
                        <BsArrowLeft />
                    </IconContext.Provider>
                </a>
            </button>
            <p>{props.title}</p>
        </div>
    );
};

export default BackButton;
