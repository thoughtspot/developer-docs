import React from 'react';
import {  navigate } from 'gatsby';

import { IconContext } from '@react-icons/all-files';
import { BsArrowLeft } from '@react-icons/all-files/bs/BsArrowLeft';
import './index.scss';

const BackButton = (props: {
    title: string;
    backLink: string;
    customStyles?: Object;
}) => {

    const clickHandler = () => {
        navigate(props.backLink, { replace: true });
    }
    return (
        <div
            data-testid="backBtn"
            className="backButtonWrapper"
            style={props?.customStyles ?? {}}
        >
            <button onClick={clickHandler}>
                <IconContext.Provider value={{ className: 'icon leftIcon' }}>
                    <BsArrowLeft />
                </IconContext.Provider>
            </button>
            <p>{props.title}</p>
        </div>
    );
};

export default BackButton;
