import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { IconContext } from '@react-icons/all-files';
import { BiLinkExternal } from '@react-icons/all-files/bi/BiLinkExternal';
import { IoIosArrowForward } from '@react-icons/all-files/io/IoIosArrowForward';
import { RiArrowDownSLine } from '@react-icons/all-files/ri/RiArrowDownSLine';
import selectors from '../../constants/selectorsContant';
import { getHTMLFromComponent } from '../../utils/react-utils';

const ArrowForwardHTML = getHTMLFromComponent(
    <IoIosArrowForward />,
    'forwardArrowIcon',
);

const ArrowDownHTML = getHTMLFromComponent(
    <RiArrowDownSLine />,
    'downArrowIcon',
);

export const addExpandCollapseImages = (
    navContent: string,
    pageId: string,
    tabsClosed: { [key: string]: boolean },
) => {
    const nav = document.createElement('div');
    nav.innerHTML = navContent;
    nav.classList.add('navWrapper');

    nav.querySelectorAll('li').forEach((el, index) => {
        if (el.children.length === 2) {
            const paragraphElement = el.children[0];
            if (paragraphElement.childNodes.length < 2) {
                paragraphElement.classList.add('linkTitle');
                const text = (paragraphElement as HTMLParagraphElement)
                    .innerText;
                // Creating arrow icons to be added
                const spanElementParent = document.createElement('span');
                spanElementParent.classList.add('iconSpan');
                const spanElementChild = document.createElement('span');
                
                // Default state is collapsed (i.e., closed)
                spanElementChild.innerHTML = ArrowForwardHTML;
                el.children[1].classList.add('displayNone');
                
                // Only open if explicitly marked as open in tabsClosed
                if (tabsClosed[text] === true) {
                    spanElementChild.innerHTML = ArrowDownHTML;
                    el.children[1].classList.remove('displayNone');
                }

                // Check if this div contains the active link
                let containsActivePage = false;
                const allLinks = el.children[1].querySelectorAll('a');
                for (let j = 0; j < allLinks.length; j++) {
                    const splitArr = allLinks[j].href.split('=');
                    if (splitArr.length > 1 && splitArr[1] === pageId) {
                        containsActivePage = true;
                        break;
                    }
                }
                
                // If this section contains the active page, always expand it
                if (containsActivePage) {
                    spanElementChild.innerHTML = ArrowDownHTML;
                    el.children[1].classList.remove('displayNone');
                }

                // Adding arrow icon to the p tags
                spanElementParent.appendChild(spanElementChild);
                paragraphElement.appendChild(spanElementParent);
            }
        } else {
            const paragraphElement = el.children[0];
            paragraphElement.classList.add('node-child');
        }
    });

    nav.innerHTML = addExternalLinkIcon(nav.innerHTML);
    return nav.innerHTML;
};

export const trimTrailingSlash = (str: string) => str.replace(/\/*$/, '');

export const getPageIdFromUrl = (href: string) => {
    const pageidMatches = href.match(/pageid=([A-z-0-9]*)/);
    const pageid =
        pageidMatches && pageidMatches.length > 1 && pageidMatches[1];

    // console.log(pageid);

    return pageid;
};

const isLinkMatching = (
    href: string | null,
    curLocation: Location | null,
    pageid: string,
) => {
    if (!href || !curLocation) return false;

    // Tutorials module pages have pageids like {subdirectory}_{real_url_ending}, must be split to generate matching URL
    const pageIdSplit = pageid.split('__');
    if (pageIdSplit.length > 1) {
        return (
            href.includes(`pageid=${pageid}`) ||
            href.includes(
                `/${encodeURI(pageIdSplit[0])}/${encodeURI(pageIdSplit[1])}#`,
            ) ||
            href.endsWith(
                `/${encodeURI(pageIdSplit[0])}/${encodeURI(pageIdSplit[1])}`,
            )
        );
    }

    return (
        href.includes(`pageid=${pageid}`) ||
        href.includes(`/${encodeURI(pageid)}#`) ||
        href.endsWith(`/${encodeURI(pageid)}`)
    );
};

const isCurrentNavOpen = (liEle: HTMLLIElement, activePageid: string) => {
    const paraEle = liEle.children[0] as HTMLParagraphElement;
    const divEle = liEle.children[1] as HTMLDivElement;
    const isLinkParentOpen =
        paraEle &&
        isLinkMatching(
            (paraEle.children[0] as HTMLAnchorElement)?.href ||
                (paraEle.children?.[0]?.children?.[0] as HTMLAnchorElement)
                    ?.href,
            window.location,
            activePageid,
        );

    const isChildOpen: boolean =
        divEle &&
        Array.from(divEle.children[0].children)
            .map((childLiEle): boolean => {
                return isCurrentNavOpen(
                    childLiEle as HTMLLIElement,
                    activePageid,
                );
            })
            .reduce((prev, cur) => {
                return prev || cur;
            }, false);

    return isLinkParentOpen || isChildOpen;
};

export const collapseAndExpandLeftNav = (
    doc: HTMLDivElement,
    setLeftNavOpen: Function,
    toggleExpandOnTab: Function,
    activePageid: string,
) => {
    // Adding click listener to close left nav when in mobile resolution
    doc?.querySelectorAll(selectors.links).forEach((link) => {
        link.addEventListener('click', () => {
            setLeftNavOpen(false);

            // When a link is clicked, store its parent's expanded state
            // This will prevent the menu from collapsing during navigation
            const parentLi = link.closest('li');
            if (
                parentLi &&
                parentLi.parentElement &&
                parentLi.parentElement.parentElement
            ) {
                const grandparentLi = parentLi.parentElement.parentElement;
                if (
                    grandparentLi.tagName === 'LI' &&
                    grandparentLi.children.length === 2
                ) {
                    const headerText = (grandparentLi
                        .children[0] as HTMLParagraphElement).innerText;
                    toggleExpandOnTab(headerText);
                }
            }
        });
    });

    doc?.querySelectorAll('li').forEach((el, i) => {
        if (el.children.length === 2) {
            const spanElement =
                el.children[0].children.length === 2
                    ? el.children[0].children[1]
                    : el.children[0].children[0];

            const isOpen = isCurrentNavOpen(el, activePageid);
            const divElement = el.children[1];

            // REMOVED: The code that was auto-collapsing menus here
            // Only expand menus containing the active page, don't collapse others
            if (isOpen) {
                divElement.classList.remove('displayNone');
            }

            if (spanElement && (spanElement.children[0] as HTMLImageElement)) {
                (spanElement
                    .children[0] as HTMLImageElement).innerHTML = divElement.classList.contains(
                    'displayNone',
                )
                    ? ArrowForwardHTML
                    : ArrowDownHTML;

                if (el.children[0].querySelectorAll('a').length === 0) {
                    // adding listener to headers that are not linked
                    el.children[0].addEventListener('click', () => {
                        toggleExpandOnTab(
                            (el.children[0] as HTMLParagraphElement).innerText,
                        );
                        divElement.classList.toggle('displayNone');
                        (spanElement
                            .children[0] as HTMLImageElement).innerHTML = divElement.classList.contains(
                            'displayNone',
                        )
                            ? ArrowForwardHTML
                            : ArrowDownHTML;
                    });
                } else {
                    // Adding click listener to the headings with links
                    spanElement.addEventListener('click', () => {
                        toggleExpandOnTab(
                            (el.children[0] as HTMLParagraphElement).innerText,
                        );
                        divElement.classList.toggle('displayNone');
                        (spanElement
                            .children[0] as HTMLImageElement).innerHTML = divElement.classList.contains(
                            'displayNone',
                        )
                            ? ArrowForwardHTML
                            : ArrowDownHTML;
                    });
                }
            }
        }
    });
};

export const getAllPageIds = (navContent: string): string[] => {
    const divElement = document.createElement('div');
    divElement.innerHTML = navContent;
    const allPageIds: string[] = [];
    divElement.querySelectorAll('a').forEach((link: HTMLAnchorElement) => {
        const splitArr = link.href.split('?');
        if (splitArr.length > 1) {
            const urlParams = new URLSearchParams(splitArr[1]);
            const pageId = urlParams.get('pageid');
            if (pageId) {
                allPageIds.push(pageId);
            }
        }
    });
    return allPageIds;
};

// Adding external icon to the external links
const addExternalLinkIcon = (navContent: string): string => {
    const divElement = document.createElement('div');
    divElement.innerHTML = navContent;
    divElement.querySelectorAll('a[target="_blank"]').forEach((link) => {
        const tempElement = document.createElement('span');
        tempElement.innerHTML = ReactDOMServer.renderToStaticMarkup(
            <IconContext.Provider
                value={{ className: 'icon externalLinkIcon' }}
            >
                <BiLinkExternal />
            </IconContext.Provider>,
        );
        link.appendChild(tempElement);
    });
    return divElement.innerHTML;
};
