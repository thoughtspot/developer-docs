import React from 'react';
import { GiHamburgerMenu } from '@react-icons/all-files/gi/GiHamburgerMenu';
import { MdClear } from '@react-icons/all-files/md/MdClear';
import './index.scss';

// Bar with only the left navigation toggle. It is rendered on narrow viewports, where the
// left sidebar is hidden until opened; on wider viewports the sidebar is always visible.
const MobileNavToggle = (props: {
    leftNavOpen: boolean;
    setLeftNavOpen: Function;
}) => {
    const { leftNavOpen, setLeftNavOpen } = props;
    return (
        <nav className="mobile-nav-toggle" aria-label="Left navigation toggle">
            <button
                className="mobile-nav-toggle__button"
                onClick={() => setLeftNavOpen((o: boolean) => !o)}
                aria-label={leftNavOpen ? 'Close navigation' : 'Open navigation'}
            >
                {leftNavOpen ? (
                    <MdClear className="mobile-nav-toggle__icon" />
                ) : (
                    <GiHamburgerMenu className="mobile-nav-toggle__icon" />
                )}
            </button>
        </nav>
    );
};

export default MobileNavToggle;
