import React from 'react';
import hljs from 'highlight.js';
import { FiCopy } from '@react-icons/all-files/fi/FiCopy';
import t from '../../utils/lang-utils';
import { getHTMLFromComponent } from '../../utils/react-utils';
import selectors from '../../constants/selectorsContant';

export const enableCopyToClipboard = (
    element: HTMLElement,
    ...args: HTMLElement[]
) => {
    element.addEventListener('click', () => {
        const text = (args[0] as HTMLElement).innerText;

        /* Copy to clipboard — prefer modern API, fall back to execCommand */
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }

        /* Tooltip appended inside the button so it floats via absolute positioning */
        if (element.querySelector('.tooltip')) return;
        const divElement = document.createElement('div');
        divElement.classList.add('tooltip');
        const spanElement = document.createElement('span');
        spanElement.classList.add('tooltiptext');
        spanElement.innerText = t('CODE_COPY_BTN_AFTER_CLICK_TEXT');
        divElement.appendChild(spanElement);
        element.appendChild(divElement);
        setTimeout(() => {
            if (element.contains(divElement)) {
                element.removeChild(divElement);
            }
        }, 1500);
    });
};

export const customizeDocContent = () => {
    /*
     * Restructure code blocks to have a permanent header bar:
     *   lang label (left)  ·  copy button (right)
     *
     * Covers all listing/literal blocks regardless of [source,lang] annotation.
     * For annotated blocks, lang is read from code[data-lang] and the code element
     * is used as the copy source. For unannotated blocks, lang is empty and the
     * pre element is the copy source.
     *
     * Guard against double-processing on re-render.
     */
    document.querySelectorAll<HTMLElement>(
        '.listingblock>.content>pre, .literalblock>.content>pre',
    ).forEach((pre) => {
        if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

        const codeEl = pre.querySelector<HTMLElement>('code[data-lang]');
        const rawLang = codeEl?.getAttribute('data-lang') || '';
        const copySource: HTMLElement = codeEl || pre;

        /* ── Header bar ── */
        const header = document.createElement('div');
        header.classList.add('code-block-header');

        /* Language label (left) */
        const langSpan = document.createElement('span');
        langSpan.classList.add('lang');
        langSpan.innerText = rawLang;
        header.appendChild(langSpan);

        /* Right group: CTA + copy button */
        const rightGroup = document.createElement('div');
        rightGroup.classList.add('code-block-header-actions');

        const ctaLink = document.createElement('a');
        ctaLink.classList.add('ctaButton');
        ctaLink.href = 'https://try.thoughtspot.com';
        ctaLink.target = '_blank';
        ctaLink.rel = 'noopener noreferrer';
        ctaLink.innerText = 'Ask SpotterCode';
        rightGroup.appendChild(ctaLink);

        /* Copy button */
        const buttonElement = document.createElement('button');
        buttonElement.setAttribute('class', 'copyButton');
        buttonElement.setAttribute('aria-label', t('CODE_COPY_BTN_HOVER_TEXT'));
        buttonElement.setAttribute('title', t('CODE_COPY_BTN_HOVER_TEXT'));

        const imageElement = document.createElement('span');
        imageElement.innerHTML = getHTMLFromComponent(<FiCopy />, 'copyIcon');
        buttonElement.appendChild(imageElement);

        enableCopyToClipboard(buttonElement, copySource);
        rightGroup.appendChild(buttonElement);

        header.appendChild(rightGroup);

        /* ── Wrap pre in code-block-wrapper ── */
        const wrapper = document.createElement('div');
        wrapper.classList.add('code-block-wrapper');
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });

    /* Add copy buttons to marked table cells (unchanged) */
    document
        .querySelectorAll('.copy-cell-table table, table.copy-cell-table')
        .forEach((table) => {
            (table as HTMLElement)
                .querySelectorAll('tbody tr td:nth-child(2)')
                .forEach((cell) => {
                    const cellElement = cell as HTMLElement;
                    if (cellElement.querySelector('.tableCopyButton')) return;

                    cellElement.classList.add('tableCopyCell');
                    const contentWrapper = document.createElement('div');
                    contentWrapper.classList.add('tableCopyContent');
                    while (cellElement.firstChild) {
                        contentWrapper.appendChild(cellElement.firstChild);
                    }
                    cellElement.appendChild(contentWrapper);

                    const buttonElement = document.createElement('button');
                    buttonElement.setAttribute('class', 'tableCopyButton');
                    buttonElement.setAttribute('aria-label', t('CODE_COPY_BTN_HOVER_TEXT'));
                    buttonElement.setAttribute('title', t('CODE_COPY_BTN_HOVER_TEXT'));

                    enableCopyToClipboard(buttonElement, contentWrapper);
                    const imageElement = document.createElement('span');
                    imageElement.innerHTML = getHTMLFromComponent(<FiCopy />, 'copyIcon');
                    buttonElement.appendChild(imageElement);
                    cellElement.appendChild(buttonElement);
                });
        });

    /* Syntax highlight */
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block as HTMLElement);
    });
};

const isInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0;
};

export const addScrollListener = () => {
    document.addEventListener('scroll', () => {
        const subLinks = document.querySelectorAll(selectors.docmapLinks);
        let flag = false;
        subLinks.forEach((link, i: number) => {
            const href = (link as HTMLAnchorElement).href;
            const hash = href.split('#')[1];
            if (hash) {
                const targetElement = document.getElementById(hash)?.parentElement;
                if (targetElement) {
                    const isVisible = isInViewport(targetElement as HTMLElement);
                    if (isVisible && !flag) {
                        link.classList.add('active');
                        link.parentElement?.classList.add('active');
                        if (
                            link?.parentElement?.parentElement?.parentElement?.tagName === 'LI'
                        ) {
                            link?.parentElement?.parentElement?.parentElement?.classList?.add('active');
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
