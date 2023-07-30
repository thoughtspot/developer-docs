import React from 'react';
import hljs from 'highlight.js';
import t from '../../utils/lang-utils';
import { RiFileCopyFill } from '@react-icons/all-files/ri/RiFileCopyFill';
import { getHTMLFromComponent } from '../../utils/react-utils';
import selectors from '../../constants/selectorsContant';

export const enableCopyToClipboard = (
    element: HTMLElement,
    ...args: HTMLElement[]
) => {
    element.addEventListener('click', () => {
        const textareaElement = document.createElement('textarea');
        textareaElement.value = (args[0] as HTMLElement).innerText;
        element.parentElement.appendChild(textareaElement);
        textareaElement.select();
        document.execCommand('copy');
        element.parentElement.removeChild(textareaElement);
        const divElement = document.createElement('div');
        divElement.classList.add('tooltip');
        const spanElement = document.createElement('span');
        spanElement.classList.add('tooltiptext');
        spanElement.innerText = t('CODE_COPY_BTN_AFTER_CLICK_TEXT');
        divElement.appendChild(spanElement);
        element.parentElement.appendChild(divElement);
        /* To remove copy tooltip */
        setTimeout(() => {
            element.parentElement.removeChild(divElement);
        }, 500);
    });
};

export const customizeDocContent = () => {
    /* To get all the code blocks from document */
    document.querySelectorAll(selectors.codeBlocks).forEach((tag) => {
        const buttonElement = document.createElement('button');
        buttonElement.setAttribute('class', 'copyButton');
        enableCopyToClipboard(buttonElement, tag as HTMLElement);
        const imageElement = document.createElement('span');
        imageElement.innerHTML = getHTMLFromComponent(
            <RiFileCopyFill />,
            'copyIcon',
        );
        buttonElement.appendChild(imageElement);
        const spanElement = document.createElement('span');
        spanElement.innerText = tag.getAttribute('data-lang');
        spanElement.classList.add('lang');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('wrapperContainer');
        wrapperDiv.appendChild(spanElement);
        wrapperDiv.appendChild(buttonElement);
        tag.parentElement.appendChild(wrapperDiv);
    });
    /* To highlight code snippets */
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block as HTMLElement);
    });
};

// Checks if the HTML element is in viewport.
const isInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0;
};

export const addScrollListener = () => {
    document.addEventListener('scroll', () => {
        const subLinks = document.querySelectorAll(selectors.docmapLinks);
        console.log(subLinks);
        let flag = false;
        subLinks.forEach((link, i: number) => {
            const href = (link as HTMLAnchorElement).href;
            const hash = href.split('#')[1];
            if (hash) {
                const targetElement = document.getElementById(hash)
                    ?.parentElement;
                if (targetElement) {
                    const isVisible = isInViewport(
                        targetElement as HTMLElement,
                    );
                    if (isVisible && !flag) {
                        link.classList.add('active');
                        link.parentElement?.classList.add('active');
                        if(link?.parentElement?.parentElement?.parentElement?.tagName === "LI"){
                            link?.parentElement?.parentElement?.parentElement?.classList?.add("active")

                        }
                        flag = !flag;
                    } else {
                        link.classList.remove('active');
                        link.parentElement?.classList.remove('active');

                    }
                }
            }
        });
    });
};
