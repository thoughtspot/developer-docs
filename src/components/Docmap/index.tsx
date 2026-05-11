import React, { useEffect, useRef, useState } from 'react';
import t from '../../utils/lang-utils';
import './index.scss';

const Docmap = (props: {
    docContent: string;
    options: Object[];
    location: Location;
}) => {
    const [toc, setToc] = useState('');
    const [activeId, setActiveId] = useState('');
    const tocRef = useRef<HTMLDivElement>(null);
    const visibleHeadings = useRef<Set<string>>(new Set());

    useEffect(() => {
        const doc = document.createElement('div');
        doc.innerHTML = props.docContent;
        const tocEl = doc.querySelector('#toc');
        if (tocEl) {
            const { hash } = props.location;
            setToc(tocEl.innerHTML);
            if (hash) {
                const ele = document.querySelector(hash);
                if (ele) {
                    ele.scrollIntoView({ block: 'start' });
                    window.scrollBy(0, -70);
                }
            }
        } else {
            setToc('');
        }
    }, [props.docContent, props.location.hash]);

    // Track which heading is currently near the top of the viewport
    useEffect(() => {
        if (!toc) return () => {};
        visibleHeadings.current.clear();

        const headings = document.querySelectorAll(
            '.documentView h2[id], .documentView h3[id], .documentView h4[id]',
        );
        if (!headings.length) return () => {};

        const headingIds = Array.from(headings).map((h) => h.id);

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        visibleHeadings.current.add(entry.target.id);
                    } else {
                        visibleHeadings.current.delete(entry.target.id);
                    }
                });
                // Pick the topmost visible heading in document order
                const topVisible = headingIds.find((id) =>
                    visibleHeadings.current.has(id),
                );
                if (topVisible) setActiveId(topVisible);
            },
            { rootMargin: '-60px 0% -40% 0%', threshold: 0 },
        );

        headings.forEach((h) => observer.observe(h));
        return () => {
            observer.disconnect();
            visibleHeadings.current.clear();
        };
    }, [toc]);

    // Apply activeTag class to the li containing the active TOC link
    useEffect(() => {
        if (!tocRef.current) return;
        tocRef.current
            .querySelectorAll('li.activeTag')
            .forEach((li) => li.classList.remove('activeTag'));
        if (activeId) {
            const link = tocRef.current.querySelector(
                `a[href="#${activeId}"]`,
            );
            if (link?.parentElement?.tagName === 'LI') {
                link.parentElement.classList.add('activeTag');
            }
        }
    }, [activeId, toc]);

    return (
        toc !== '' && (
            <div className="docmapLinks">
                <p className="tocTitle">{t('RIGHT_NAV_SIDERBAR_TITLE')}</p>
                <div
                    ref={tocRef}
                    data-testid="toc"
                    dangerouslySetInnerHTML={{ __html: toc }}
                />
            </div>
        )
    );
};

export default Docmap;
