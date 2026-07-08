import React, { useEffect, useState, useRef } from 'react';
import './index.scss';
import { customizeDocContent, addScrollListener } from './helper';
import Footer from '../Footer';
import Breadcrums from '../Breadcrums';
import LinkableHeader from '../LinkableHeader';
import WasThisHelpful from '../WasThisHelpful';
import CopyPageDropdown from '../CopyPageDropdown';
import { HOME_PAGE_ID } from '../../configs/doc-configs';
import { useFloatingAssistant } from '../../contexts/FloatingAssistantContext';
import parse, { HTMLReactParserOptions, domToReact, attributesToProps } from 'html-react-parser';

const Document = (props: {
    pageid?: string;
    docTitle: string;
    docContent: string;
    isPublicSiteOpen: boolean;
    shouldShowRightNav: boolean;
    breadcrumsData: any;
    markdownBody?: string;
}) => {
    const { setIsOpen, setQuotedText } = useFloatingAssistant();
    const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
    const selectionRef = useRef<string>('');

    useEffect(() => {
        let mouseDownX = 0;
        let mouseDownY = 0;

        const handleMouseUp = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.selection-cta-button')) return;

            // If mouse didn't move (plain click, not a drag-select), don't re-show
            const moved = Math.abs(e.clientX - mouseDownX) > 3 || Math.abs(e.clientY - mouseDownY) > 3;
            if (!moved) return;

            const selection = window.getSelection();
            const text = selection?.toString().trim() || '';
            if (!text) {
                setSelectionPos(null);
                return;
            }
            const range = selection!.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            selectionRef.current = text;
            const HEADER_HEIGHT = 108; // main header (60) + secondary header (48)
            const BUTTON_HEIGHT = 36;
            const rawTop = rect.top - BUTTON_HEIGHT - 6;
            setSelectionPos({
                top: Math.max(HEADER_HEIGHT + 4, rawTop),
                left: Math.max(8, e.clientX - 80),
            });
        };

        const handleMouseDown = (e: MouseEvent) => {
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            if ((e.target as HTMLElement).closest('.selection-cta-button')) return;
            setSelectionPos(null);
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    useEffect(() => {
        customizeDocContent();
    }, [props.docContent]);

    useEffect(() => {
        addScrollListener();
    }, []);

    useEffect(() => {
        /* ── Tabbed code blocks ──────────────────────────────────────────
         * Authoring: wrap multiple [source,...] blocks in [.tabbed-code] --
         * This effect collapses them into a single panel with language tabs.
         */
        document.querySelectorAll<HTMLElement>('.tabbed-code').forEach((container) => {
            const wrappers = Array.from(
                container.querySelectorAll<HTMLElement>('.code-block-wrapper'),
            );
            if (wrappers.length < 2) return;

            const entries = wrappers.map((w) => ({
                lang: w.querySelector<HTMLElement>('.lang')?.textContent?.trim() || 'Code',
                pre: w.querySelector<HTMLElement>('pre'),
            })).filter((e) => e.pre);

            if (entries.length < 2) return;

            /* Build unified wrapper */
            const block = document.createElement('div');
            block.className = 'code-block-wrapper';

            /* Shared header: tab buttons + copy button */
            const header = document.createElement('div');
            header.className = 'code-block-header';

            const tabsRow = document.createElement('div');
            tabsRow.className = 'code-tabs-list';
            header.appendChild(tabsRow);

            /* Copy button — copies visible tab content */
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copyButton';
            copyBtn.innerHTML = `<svg class="copyIcon" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>`;
            header.appendChild(copyBtn);
            block.appendChild(header);

            /* Panels */
            const panels: HTMLElement[] = [];
            entries.forEach(({ lang, pre }, idx) => {
                const btn = document.createElement('button');
                btn.className = 'code-tab-btn' + (idx === 0 ? ' active' : '');
                btn.textContent = lang;
                tabsRow.appendChild(btn);

                const panel = document.createElement('div');
                panel.className = 'code-tab-panel';
                if (idx > 0) panel.hidden = true;
                const preClone = pre!.cloneNode(true) as HTMLElement;
                panel.appendChild(preClone);
                block.appendChild(panel);
                panels.push(panel);

                btn.addEventListener('click', () => {
                    tabsRow.querySelectorAll('.code-tab-btn').forEach((b) =>
                        b.classList.remove('active'),
                    );
                    panels.forEach((p) => { p.hidden = true; });
                    btn.classList.add('active');
                    panel.hidden = false;
                });
            });

            copyBtn.addEventListener('click', () => {
                const visiblePanel = panels.find((p) => !p.hidden);
                const text = visiblePanel?.querySelector('pre')?.textContent || '';
                navigator.clipboard.writeText(text).catch(() => {});
                copyBtn.innerHTML = '<span style="font-size:11px;padding:0 2px">Copied!</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg class="copyIcon" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>`;
                }, 1500);
            });

            container.replaceChildren(block);
        });
    }, [props.docContent]);

    const options: HTMLReactParserOptions = {
        replace: (domNode: any) => {
            if (domNode.type === 'tag' &&
                ['h2', 'h3', 'h4'].includes(domNode.name) &&
                !domNode.parent?.attribs?.class?.includes('non-link')
            ) {
                const nodeProps = attributesToProps(domNode.attribs);
                return (<LinkableHeader {...nodeProps} tag={domNode.name} id={domNode.attribs.id}>
                    {domToReact(domNode.children, options)}
                </LinkableHeader>)
            }
            return undefined;
        }
    };

    const isHomePage = props.pageid === HOME_PAGE_ID;

    return (
        <div
            className="documentWrapper"
            style={!props.shouldShowRightNav ? { width: '100%' } : undefined}
        >
            {selectionPos && (
                <button
                    className="selection-cta-button"
                    style={{ top: selectionPos.top, left: selectionPos.left }}
                    onClick={() => {
                        const selected = selectionRef.current;
                        setSelectionPos(null);
                        setQuotedText(selected);
                        setIsOpen(true);
                    }}
                >
                    Ask SpotterCode
                </button>
            )}
            {!isHomePage && (
                <Breadcrums
                    breadcrumsData={props.breadcrumsData}
                    pageid={props.pageid}
                />
            )}
            {!isHomePage && props.isPublicSiteOpen && (
                <div className="document-toolbar">
                    <CopyPageDropdown pageTitle={props.docTitle} markdownBody={props.markdownBody} />
                </div>
            )}
            <div
                id={props.docTitle}
                className="documentView"
            >
                {parse(props.docContent, options)}
            </div>
            {/* WasThisHelpful temporarily disabled — no endpoint configured yet
            {!isHomePage && props.isPublicSiteOpen && (
                <WasThisHelpful />
            )}
            */}
            {props.isPublicSiteOpen && <Footer />}
        </div>
    );
};

export default Document;
