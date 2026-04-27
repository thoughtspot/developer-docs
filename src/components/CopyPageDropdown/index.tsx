import React, { useState, useRef, useEffect } from 'react';
import { IconContext } from '@react-icons/all-files';
import { FiCopy } from '@react-icons/all-files/fi/FiCopy';
import { FiChevronDown } from '@react-icons/all-files/fi/FiChevronDown';
import { FiExternalLink } from '@react-icons/all-files/fi/FiExternalLink';
import './index.scss';

type CopyPageDropdownProps = {
    pageTitle?: string;
    markdownBody?: string;
};

const CopyPageDropdown = (props: CopyPageDropdownProps) => {
    const { pageTitle, markdownBody } = props;
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getPageMarkdown = (): string => {
        const sourceUrl = typeof window !== 'undefined' ? window.location.href : '';
        const header = sourceUrl ? `Source: ${sourceUrl}\n\n` : '';

        /* Prefer build-time Markdown — clean headings, no chain icons */
        if (markdownBody) {
            return `${header}${markdownBody}`;
        }

        /* Fallback: browser scrape (used if GraphQL field is missing) */
        const title = pageTitle || (typeof document !== 'undefined' ? document.title : '');
        const contentEl = typeof document !== 'undefined'
            ? (document.querySelector('.documentView') as HTMLElement)
            : null;
        if (!contentEl) return `# ${title}\n\n${sourceUrl}`;

        const tmp = document.createElement('div');
        tmp.innerHTML = contentEl.innerHTML;
        tmp.querySelectorAll('script, style, a.anchor').forEach(el => el.remove());
        const text = (tmp.innerText || tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
        return `# ${title}\n\n${header}${text}`;
    };

    const handleCopyMarkdown = async () => {
        try {
            const md = getPageMarkdown();
            await navigator.clipboard.writeText(md);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.warn('Clipboard write failed:', err);
        }
        setOpen(false);
    };

    const handleOpenInAI = (aiService: 'chatgpt' | 'claude') => {
        const pageUrl = window.location.href;
        const prompt = encodeURIComponent(
            `Read ${pageUrl} so I can ask questions about it.`
        );
        const url = aiService === 'chatgpt'
            ? `https://chatgpt.com/?q=${prompt}`
            : `https://claude.ai/new?q=${prompt}`;

        window.open(url, '_blank', 'noopener,noreferrer');
        setOpen(false);
    };

    const handleViewMarkdown = () => {
        const md = getPageMarkdown();
        const blob = new Blob([md], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        setOpen(false);
    };

    return (
        <div className="copy-page-dropdown" ref={ref}>
            <button
                className={`copy-page-dropdown__trigger ${copied ? 'copied' : ''}`}
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="true"
                title="Copy or share this page"
            >
                <IconContext.Provider value={{ className: 'copy-page-icon' }}>
                    <FiCopy />
                </IconContext.Provider>
                <span>{copied ? 'Copied!' : 'Copy page'}</span>
                <IconContext.Provider value={{ className: 'copy-chevron' }}>
                    <FiChevronDown />
                </IconContext.Provider>
            </button>

            {open && (
                <div className="copy-page-dropdown__menu" role="menu">
                    <button
                        className="copy-page-dropdown__item"
                        role="menuitem"
                        onClick={handleCopyMarkdown}
                    >
                        <IconContext.Provider value={{ className: 'menu-item-icon' }}>
                            <FiCopy />
                        </IconContext.Provider>
                        <span className="copy-page-dropdown__item-text">
                            <span className="copy-page-dropdown__item-label">Copy as Markdown</span>
                            <span className="copy-page-dropdown__item-sub">Copy page content to clipboard</span>
                        </span>
                    </button>

                    <button
                        className="copy-page-dropdown__item"
                        role="menuitem"
                        onClick={() => handleOpenInAI('chatgpt')}
                    >
                        <IconContext.Provider value={{ className: 'menu-item-icon' }}>
                            <FiExternalLink />
                        </IconContext.Provider>
                        <span className="copy-page-dropdown__item-text">
                            <span className="copy-page-dropdown__item-label">Open in ChatGPT</span>
                            <span className="copy-page-dropdown__item-sub">Ask questions about this page</span>
                        </span>
                    </button>

                    <button
                        className="copy-page-dropdown__item"
                        role="menuitem"
                        onClick={() => handleOpenInAI('claude')}
                    >
                        <IconContext.Provider value={{ className: 'menu-item-icon' }}>
                            <FiExternalLink />
                        </IconContext.Provider>
                        <span className="copy-page-dropdown__item-text">
                            <span className="copy-page-dropdown__item-label">Open in Claude</span>
                            <span className="copy-page-dropdown__item-sub">Ask questions about this page</span>
                        </span>
                    </button>

                    <div className="copy-page-dropdown__separator" role="separator" />

                    <button
                        className="copy-page-dropdown__item"
                        role="menuitem"
                        onClick={handleViewMarkdown}
                    >
                        <IconContext.Provider value={{ className: 'menu-item-icon' }}>
                            <FiExternalLink />
                        </IconContext.Provider>
                        <span className="copy-page-dropdown__item-text">
                            <span className="copy-page-dropdown__item-label">View as Markdown</span>
                            <span className="copy-page-dropdown__item-sub">Preview raw Markdown in new tab</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default CopyPageDropdown;
