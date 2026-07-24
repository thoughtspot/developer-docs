import React, { useEffect, useState, useRef } from 'react';
import { ResizableBox } from 'react-resizable';
import { useResizeDetector } from 'react-resize-detector';
import { removeTrailingSlash, queryStringParser } from '../../utils/app-utils';
import { NAV_PREFIX, TS_PAGE_ID_PARAM } from '../../configs/doc-configs';
import {
    LEFT_NAV_WIDTH_DESKTOP,
    LEFT_NAV_WIDTH_TABLET,
    MAX_LEFT_NAV_WIDTH_DESKTOP,
    MAX_LEFT_NAV_WIDTH_TABLET,
    MAX_TABLET_RESOLUTION,
    MIN_LEFT_NAV_WIDTH_DESKTOP,
    MIN_LEFT_NAV_WIDTH_TABLET,
    MAX_MOBILE_RESOLUTION,
} from '../../constants/uiConstants';
import {
    collapseAndExpandLeftNav,
    addExpandCollapseImages,
    getPageIdFromUrl,
} from './helper';
import NavContent from './NavContent';
import './index.scss';

const LeftSideBar = (props: {
    navTitle: string;
    navContent: string;
    backLink?: string;
    docWidth: number;
    leftNavOpen: boolean;
    isMaxMobileResolution: boolean;
    isDarkMode: boolean;
    location: Location;
    setLeftNavOpen: Function;
    isPublicSiteOpen: boolean;
    setDarkMode: Function;
    curPageid: string;
    searchClickHandler: Function;
}) => {
    const params = queryStringParser(props.location.search);
    const [navContent, setNavContent] = useState('');
    const { width, ref, height } = useResizeDetector();

    const expandedTabsRef = useRef({});
    const lastScrolledPageIdRef = useRef<string | null>(null);

    const isMaxTabletResolution = !(props.docWidth < MAX_TABLET_RESOLUTION);
    const isMaxMobileResolution = !(props.docWidth < MAX_MOBILE_RESOLUTION);

    useEffect(() => {
        const divElement = document.createElement('div');
        divElement.innerHTML = props.navContent;
        const pageid =
            removeTrailingSlash(props.location.pathname).replace(/^\/*/, '') ||
            getPageIdFromUrl(props.location.href);
        const allLinks = divElement.querySelectorAll('a');
        const tag = Array.from(allLinks).find((a) => {
            const href = a.getAttribute('href');
            return href === `/${pageid}` || href?.endsWith(`/${pageid}`);
        });
        if (tag) {
            tag.classList.add('active');
        }

        const updatedHTML = addExpandCollapseImages(
            divElement.innerHTML,
            params[TS_PAGE_ID_PARAM],
            expandedTabsRef.current,
        );
        setNavContent(updatedHTML);
    }, [params[NAV_PREFIX], params[TS_PAGE_ID_PARAM], props.navContent, props.location.pathname]);

    const toggleExpandOnTab = (text: string) => {
        const allTabsRef = { ...expandedTabsRef.current };
        if (allTabsRef[text] !== undefined) {
            allTabsRef[text] = !allTabsRef[text];
        } else {
            allTabsRef[text] = true;
        }
        expandedTabsRef.current = { ...allTabsRef };
    };
    useEffect(() => {
        collapseAndExpandLeftNav(
            ref.current as HTMLDivElement,
            props.setLeftNavOpen,
            toggleExpandOnTab,
            props.curPageid,
        );

        // Every navigation is a full page reload, so the sidebar always
        // remounts scrolled to the top. Bring the active link back into view
        // once per navigation (guarded by curPageid) so a resize or category
        // switch on the same page doesn't re-trigger and jump the scroll
        // position out from under the user. navContent starts out empty on
        // mount and is filled in a render later, so don't mark the page as
        // "scrolled" until the active link actually exists to scroll to.
        // On mobile widths, .aside is display:none until leftNavOpen is
        // true (index.scss:365-381) — scrollIntoView on a hidden element
        // is a no-op, so wait for the nav to actually be visible (desktop/
        // tablet is always visible; mobile only once opened) before
        // marking this navigation as handled.
        const isAsideVisible = isMaxMobileResolution || props.leftNavOpen;
        if (lastScrolledPageIdRef.current !== props.curPageid && isAsideVisible) {
            const activeLink = (ref.current as HTMLDivElement)?.querySelector(
                'a.active',
            );
            if (activeLink) {
                lastScrolledPageIdRef.current = props.curPageid;
                activeLink.scrollIntoView({ block: 'center' });
            }
        }
    }, [props.curPageid, isMaxMobileResolution, navContent, props.leftNavOpen]);

    const renderLeftNav = () => {
        return isMaxMobileResolution ? (
            <div className="resizable-container">
                <ResizableBox
                    width={
                        isMaxTabletResolution
                            ? LEFT_NAV_WIDTH_DESKTOP
                            : LEFT_NAV_WIDTH_TABLET
                    }
                    minConstraints={[
                        isMaxTabletResolution
                            ? MIN_LEFT_NAV_WIDTH_DESKTOP
                            : MIN_LEFT_NAV_WIDTH_TABLET,
                    ]}
                    maxConstraints={[
                        isMaxTabletResolution
                            ? MAX_LEFT_NAV_WIDTH_DESKTOP
                            : MAX_LEFT_NAV_WIDTH_TABLET,
                    ]}
                    axis="x"
                    className="resizable"
                >
                    <NavContent
                        backLink={props.backLink}
                        navContent={navContent}
                        navTitle={props.navTitle}
                        refObj={ref as React.RefObject<HTMLDivElement>}
                        leftNavOpen={props.leftNavOpen}
                        isPublicSiteOpen={props.isPublicSiteOpen}
                        isMaxMobileResolution={isMaxMobileResolution}
                        setDarkMode={props.setDarkMode}
                        isDarkMode={props.isDarkMode}
                        searchClickHandler={props.searchClickHandler}
                    />
                </ResizableBox>
            </div>
        ) : (
            <div className="menuMain">
                <NavContent
                    backLink={props.backLink}
                    navContent={navContent}
                    navTitle={props.navTitle}
                    refObj={ref as React.RefObject<HTMLDivElement>}
                    leftNavOpen={props.leftNavOpen}
                    isPublicSiteOpen={props.isPublicSiteOpen}
                    isMaxMobileResolution={isMaxMobileResolution}
                    setDarkMode={props.setDarkMode}
                    isDarkMode={props.isDarkMode}
                    searchClickHandler={props.searchClickHandler}
                />
            </div>
        );
    };

    return renderLeftNav();
};

export default LeftSideBar;
