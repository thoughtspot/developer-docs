import React from 'react';
import hljs from 'highlight.js';
import { MdContentCopy } from '@react-icons/all-files/md/MdContentCopy';
import { MdCheck } from '@react-icons/all-files/md/MdCheck';
import t from '../../utils/lang-utils';
import { getHTMLFromComponent } from '../../utils/react-utils';
import { isTutorialsPath } from '../../utils/app-utils';
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

        /* Swap the icon for a checkmark and reverting after a delay. The
           "Copied" text is no longer shown as an always-visible popup —
           it's only surfaced via `aria-label`/`title`, which browsers only
           display on hover. `.copyIcon` is the <svg> itself, so replace it
           wholesale via outerHTML rather than innerHTML, which would nest a
           new svg inside the existing one instead of swapping it. */
        const iconEl = element.querySelector('.copyIcon');
        if (iconEl) {
            iconEl.outerHTML = getHTMLFromComponent(<MdCheck />, 'copyIcon');
        }
        element.classList.add('copied');
        element.setAttribute('aria-label', t('CODE_COPY_BTN_AFTER_CLICK_TEXT'));
        element.setAttribute('title', t('CODE_COPY_BTN_AFTER_CLICK_TEXT'));

        setTimeout(() => {
            const icon = element.querySelector('.copyIcon');
            if (icon) {
                icon.outerHTML = getHTMLFromComponent(<MdContentCopy />, 'copyIcon');
            }
            element.classList.remove('copied');
            element.setAttribute('aria-label', t('CODE_COPY_BTN_HOVER_TEXT'));
            element.setAttribute('title', t('CODE_COPY_BTN_HOVER_TEXT'));
        }, 1500);
    });
};

/* Document/index.tsx wraps every h2/h3/h4 in <LinkableHeader>, which
 * appends a literal 🔗 anchor-link icon inside the heading (see
 * LinkableHeader/index.tsx) — reading a heading's `.textContent` directly
 * drags that emoji along with it. Used below both to build "Feature
 * category" filter values and to detect the "Breaking Changes" section by
 * heading text; strip it first so neither one is comparing/displaying
 * "Spotter🔗" or failing to match "breaking changes🔗" !== "breaking changes". */
const getHeadingText = (heading: Element | null | undefined) => {
    if (!heading) return '';
    const clone = heading.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.link-element').forEach((el) => el.remove());
    return clone.textContent?.trim() || '';
};

/* Shared by both release-notes filter bars below: a labelled <select> with
 * a leading "All" option, styled via .release-notes-filterbar-field. */
const makeFilterSelect = (label: string, options: string[]) => {
    const field = document.createElement('label');
    field.classList.add('release-notes-filterbar-field');

    const span = document.createElement('span');
    span.textContent = label;

    const select = document.createElement('select');
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All';
    select.appendChild(allOption);
    options.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    const chevron = document.createElement('span');
    chevron.classList.add('release-notes-filterbar-chevron');
    chevron.setAttribute('aria-hidden', 'true');

    field.appendChild(span);
    field.appendChild(select);
    field.appendChild(chevron);
    return { field, select };
};

// Header (60px) + secondary nav (48px) — same offset the site's own
// SecondaryHeader docks under; see $header-height in variables.scss.
const FILTERBAR_PIN_TOP = 108;

// customizeDocContent() reruns on every page navigation in this SPA and
// rebuilds the filter bar from scratch — without this, each run's
// scroll/resize listeners would pile up on `window` forever, each one
// still holding a closure over its (by-then-detached) filterBar/spacer
// from a page the user already left.
let teardownFilterBarListeners: (() => void) | null = null;

/* This app shell doesn't scroll the window/body at all (`body` is
 * `overflow-y: hidden`) — the actual scrolling happens inside a nested
 * container (.documentWrapperContainer as of this writing). `window.scroll`
 * / `window.scrollY` are always 0 here; walk up from a known descendant to
 * find whichever ancestor is genuinely scrollable, rather than hardcoding
 * that class name. */
const findScrollParent = (el: HTMLElement): HTMLElement => {
    let node = el.parentElement;
    while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight
        ) {
            return node;
        }
        node = node.parentElement;
    }
    return document.scrollingElement as HTMLElement;
};

/* Mounts a release-notes filter bar right after the page's own <h1>. It
 * starts in normal flow (no position override) and only becomes
 * `position: fixed` — via the `.is-pinned` class in index.scss — once the
 * user has scrolled it up to the header, at which point it docks there
 * like Stripe's changelog filter bar. Three things this deliberately avoids:
 *
 * - Listening on `window`/`document` for scroll: see findScrollParent above
 *   — on this site that never fires, since the window itself never
 *   scrolls. The real scroll container has to be found dynamically and
 *   listened to instead.
 * - `position: sticky` here produces a large, unexplained gap above the
 *   bar and a real layout overlap with the content right after it (tested
 *   directly: switching to `static` removes both) — almost certainly the
 *   same root cause as the point above: sticky's offset is computed
 *   against the nearest scrolling ancestor, not the viewport, and that
 *   ancestor's own box doesn't start at viewport (0,0). Toggling
 *   `position: fixed` via a scroll listener sidesteps that entirely, and
 *   `fixed` is genuinely viewport-relative regardless of which ancestor
 *   scrolls, so its left/width don't need to be recomputed as the user
 *   scrolls — only on resize.
 * - `.documentView`'s own bounding box spans the full viewport width
 *   regardless of the visible sidebar (the sidebar is a `position: fixed`
 *   overlay painted on top of it, not a flex sibling that narrows it —
 *   only .documentView's children get padded to visually clear it), so it
 *   can't be used to compute the pinned bar's left/width. The bar's own
 *   rect, read while still in normal flow, is correct instead — it's a
 *   real rendered child, so it already reflects that padding, same as any
 *   paragraph.
 *
 * A spacer sits right after the bar and only gets a height once pinned,
 * so pinning doesn't yank the content below it upward. */
const mountFilterBar = (filterBar: HTMLElement, documentView: HTMLElement) => {
    const docTitle = documentView.querySelector(':scope > h1');
    const parent = docTitle?.parentNode ?? documentView;
    const anchor = docTitle ? docTitle.nextSibling : documentView.firstChild;

    parent.insertBefore(filterBar, anchor);

    const spacer = document.createElement('div');
    spacer.classList.add('release-notes-filterbar-spacer');
    parent.insertBefore(spacer, filterBar.nextSibling);

    const scrollParent = findScrollParent(documentView);

    let pinnedLeft = 0;
    let pinnedWidth = 0;
    let pinnedHeight = 0;
    let pinThresholdScrollTop = 0;

    // Left/width/threshold can only be measured correctly while the bar is
    // in normal flow — briefly drop `.is-pinned` if needed to remeasure.
    const measure = () => {
        const wasPinned = filterBar.classList.contains('is-pinned');
        if (wasPinned) filterBar.classList.remove('is-pinned');

        const rect = filterBar.getBoundingClientRect();
        pinnedLeft = rect.left;
        pinnedWidth = rect.width;
        pinnedHeight = rect.height;
        pinThresholdScrollTop = scrollParent.scrollTop + rect.top - FILTERBAR_PIN_TOP;

        if (wasPinned) filterBar.classList.add('is-pinned');
    };

    const update = () => {
        const shouldPin = scrollParent.scrollTop >= pinThresholdScrollTop;
        const isPinned = filterBar.classList.contains('is-pinned');

        if (shouldPin && !isPinned) {
            filterBar.style.left = `${pinnedLeft}px`;
            filterBar.style.width = `${pinnedWidth}px`;
            filterBar.classList.add('is-pinned');
            spacer.style.height = `${pinnedHeight}px`;
        } else if (!shouldPin && isPinned) {
            filterBar.classList.remove('is-pinned');
            spacer.style.height = '0px';
        }
    };

    const onResize = () => {
        measure();
        update();
    };

    measure();
    update();
    scrollParent.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onResize);

    teardownFilterBarListeners = () => {
        scrollParent.removeEventListener('scroll', update);
        window.removeEventListener('resize', onResize);
    };
};

export const customizeDocContent = () => {
    /* Tear down the previous page's filter bar listeners (see
     * teardownFilterBarListeners above) before removing its DOM, and
     * defensively clear any leftover filter bar (e.g. React 18
     * double-invoking this effect in dev) — rebuilt fresh below if the
     * current page needs one. */
    teardownFilterBarListeners?.();
    teardownFilterBarListeners = null;
    document.querySelectorAll('.release-notes-filterbar').forEach((el) => el.remove());

    /*
     * Restructure code blocks to have a permanent header bar:
     *   lang label (left)  ·  Ask SpotterCode + copy button (right)
     *
     * Covers all listing/literal blocks regardless of [source,lang] annotation.
     * For annotated blocks, lang is read from code[data-lang] and the code element
     * is used as the copy source. For unannotated blocks, lang is empty and the
     * pre element is the copy source.
     *
     * Guard against double-processing on re-render.
     */
    // The SpotterCode assistant is hidden entirely on tutorials pages (see
    // FloatingAssistant) — its "Ask SpotterCode" CTA here would just dispatch
    // spotter-code-ask to nothing. Keep the copy button everywhere, including there.
    const hideAskSpotterCode =
        typeof window !== 'undefined' && isTutorialsPath(window.location.pathname);

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

        if (!hideAskSpotterCode) {
            const ctaLink = document.createElement('button');
            ctaLink.classList.add('ctaButton');
            ctaLink.innerText = 'Ask SpotterCode';
            ctaLink.addEventListener('click', () => {
                const code = copySource.innerText.trim();
                window.dispatchEvent(new CustomEvent('spotter-code-ask', { detail: { quotedText: code } }));
            });
            rightGroup.appendChild(ctaLink);
        }

        /* Copy button — icon style */
        const buttonElement = document.createElement('button');
        buttonElement.setAttribute('class', 'copyButton');
        buttonElement.setAttribute('aria-label', t('CODE_COPY_BTN_HOVER_TEXT'));
        buttonElement.setAttribute('title', t('CODE_COPY_BTN_HOVER_TEXT'));

        const imageElement = document.createElement('span');
        imageElement.innerHTML = getHTMLFromComponent(<MdContentCopy />, 'copyIcon');
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
                    imageElement.innerHTML = getHTMLFromComponent(<MdContentCopy />, 'copyIcon');
                    buttonElement.appendChild(imageElement);
                    cellElement.appendChild(buttonElement);
                });
        });

    /* Syntax highlight */
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block as HTMLElement);
    });

    /*
     * Autoplaying <video> elements without `muted` get silently blocked or
     * repeatedly stalled by the browser's autoplay policy in a real (non-
     * automated) browser — each buffering/retry attempt can intercept
     * trackpad scroll for a second or two. The video:: macro's options list
     * doesn't forward "muted" through this Asciidoctor version, so set it
     * directly on the element instead.
     */
    document.querySelectorAll<HTMLVideoElement>('video[autoplay]').forEach((video) => {
        video.muted = true;
        video.setAttribute('muted', '');
        // Setting `muted` after the browser already evaluated (and likely
        // blocked) the initial autoplay attempt doesn't retroactively start
        // playback — re-trigger it explicitly.
        video.play().catch(() => {});
    });

    /*
     * Expand/collapse for code blocks taller than the collapsed max-height.
     * Avoids trapping mouse-wheel scroll inside a nested scrollbar: collapsed
     * blocks clip + fade instead of scrolling internally; "Show more" reveals
     * the full block (no scroll) so page scroll takes over normally.
     */
    document.querySelectorAll<HTMLElement>('.code-block-wrapper').forEach((wrapper) => {
        if (wrapper.querySelector('.code-expand-btn')) return;

        const pre = wrapper.querySelector('pre');
        if (!pre) return;

        if (pre.scrollHeight <= pre.clientHeight + 2) return;

        wrapper.classList.add('has-overflow');

        const expandBtn = document.createElement('button');
        expandBtn.classList.add('code-expand-btn');
        expandBtn.textContent = 'Show more';
        expandBtn.addEventListener('click', () => {
            const isExpanded = wrapper.classList.toggle('expanded');
            expandBtn.textContent = isExpanded ? 'Show less' : 'Show more';
        });
        wrapper.appendChild(expandBtn);
    });

    /*
     * Release-notes tables ([.release-notes-table] role in AsciiDoc):
     *  - A single page-level filter bar (Breaking changes toggle, Product,
     *    and whatever other metadata columns the page's tables author —
     *    Feature category, Version, ...) sits above every dated release
     *    section and filters matching rows across ALL tables on the page at
     *    once — not a per-table dropdown. A date (h2/.sect1) or subsection
     *    (h3/.sect2) collapses out of view entirely once nothing inside it
     *    matches.
     *  - Metadata columns are matched by their header text, not position,
     *    so different template variants can author different columns (the
     *    TSE template only has Feature category; the weekly template also
     *    has Product and Version) without this code caring which column
     *    index means what on a given table. A table that doesn't author a
     *    given column simply isn't affected by that filter dimension —
     *    it's never treated as a non-match.
     *  - Per-row "Show more" for Description cells taller than one line:
     *    the overflow is clipped and blurred (not faded), and the button
     *    itself only appears on hover/focus of the cell rather than sitting
     *    visible below the text at all times.
     * Guard against double-processing on re-render.
     */
    const releaseNotesTables = Array.from(
        document.querySelectorAll<HTMLTableElement>(
            '.release-notes-table table, table.release-notes-table',
        ),
    );

    if (releaseNotesTables.length) {
        const documentView = document.querySelector<HTMLElement>('.documentView');

        // Fixed, org-wide product taxonomy — unlike the other metadata
        // columns below, this isn't derived from what's on the page, so it
        // stays stable even on a page that only happens to mention one or
        // two products.
        const PRODUCTS = ['ThoughtSpot Application', 'ThoughtSpot Embedded', 'APIs and SDK', 'AgentSpot', 'MCP Server'];

        // { table -> { header label -> 1-based column index } }, built from
        // each table's own header row (skipping column 1, Description,
        // which is never a filter dimension).
        const columnIndexByTable = new Map<HTMLTableElement, Map<string, number>>();
        releaseNotesTables.forEach((table) => {
            const colMap = new Map<string, number>();
            Array.from(table.querySelectorAll<HTMLElement>('thead th')).forEach((th, i) => {
                if (i === 0) return;
                const label = getHeadingText(th);
                if (label) colMap.set(label, i + 1);
            });
            columnIndexByTable.set(table, colMap);
        });

        // Hide each table's recognized metadata columns (whatever's in its
        // own colMap — Product, Feature, Version, Type, ...) directly via
        // inline styles, rather than a blanket "everything but column 1"
        // CSS rule — that assumed exactly one visible column, which breaks
        // for a table authored with two visible columns (e.g. Week +
        // Description on a master-list page). Column 1 is always visible
        // (colMap never contains it); any other column stays visible too,
        // as long as its header was left blank when authoring the table.
        releaseNotesTables.forEach((table) => {
            if (table.dataset.releaseNotesColsInit) return;
            table.dataset.releaseNotesColsInit = 'true';

            const colMap = columnIndexByTable.get(table);
            if (!colMap) return;
            const hiddenIndices = new Set(Array.from(colMap.values()));

            Array.from(table.querySelectorAll<HTMLElement>('colgroup col')).forEach((col, i) => {
                if (hiddenIndices.has(i + 1)) col.style.display = 'none';
            });

            const headerCells = Array.from(table.querySelectorAll<HTMLElement>('thead th'));
            headerCells.forEach((th, i) => {
                if (hiddenIndices.has(i + 1)) th.style.display = 'none';
            });
            const visibleHeaders = headerCells.filter((_, i) => !hiddenIndices.has(i + 1));
            visibleHeaders.forEach((th, i) => {
                th.style.borderRight = i === visibleHeaders.length - 1 ? 'none' : '';
            });

            Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).forEach((row) => {
                const cells = Array.from(row.querySelectorAll<HTMLElement>('td'));
                cells.forEach((td, i) => {
                    if (hiddenIndices.has(i + 1)) td.style.display = 'none';
                });
                const visibleCells = cells.filter((_, i) => !hiddenIndices.has(i + 1));
                visibleCells.forEach((td, i) => {
                    td.style.borderRight = i === visibleCells.length - 1 ? 'none' : '';
                });
            });
        });

        const hasProductColumn = Array.from(columnIndexByTable.values()).some((colMap) => colMap.has('Product'));

        // Every other metadata label used by any table on the page, in
        // first-seen order.
        const dimensionLabels: string[] = [];
        columnIndexByTable.forEach((colMap) => {
            colMap.forEach((_, label) => {
                if (label !== 'Product' && !dimensionLabels.includes(label)) dimensionLabels.push(label);
            });
        });

        if (documentView) {
            const filterBar = document.createElement('div');
            filterBar.classList.add('release-notes-filterbar');

            // A "Type" column (Fix / Enhancement / Breaking change / ...)
            // supersedes the "Breaking changes only" toggle — it's the same
            // idea generalized into a proper filter dimension. Only fall
            // back to the toggle on pages whose tables don't author Type —
            // and only if the page actually has dated .sect2 subsections for
            // it to collapse; a flat master-list table (e.g. a page linking
            // out to each release's own digest) has none, so the toggle
            // would have nothing to do.
            const hasTypeColumn = dimensionLabels.includes('Type');
            const hasSect2Structure = document.querySelectorAll('.sect2').length > 0;
            let breakingCheckbox: HTMLInputElement | null = null;

            if (!hasTypeColumn && hasSect2Structure) {
                const breakingField = document.createElement('label');
                breakingField.classList.add('release-notes-filterbar-toggle');
                breakingCheckbox = document.createElement('input');
                breakingCheckbox.type = 'checkbox';
                const breakingLabel = document.createElement('span');
                breakingLabel.textContent = 'Breaking changes only';
                breakingField.appendChild(breakingCheckbox);
                breakingField.appendChild(breakingLabel);
                filterBar.appendChild(breakingField);
            }

            const selectsByLabel = new Map<string, HTMLSelectElement>();

            if (hasProductColumn) {
                const { field, select } = makeFilterSelect('Product', PRODUCTS);
                filterBar.appendChild(field);
                selectsByLabel.set('Product', select);
            }

            dimensionLabels.forEach((label) => {
                // Version reads newest-first, matching how these pages are
                // already authored, rather than alphabetically — a lexical
                // sort would put "1.10.0" ahead of "1.9.0".
                const preserveDocOrder = label.toLowerCase() === 'version';
                const values = new Set<string>();
                releaseNotesTables.forEach((table) => {
                    const colIndex = columnIndexByTable.get(table)?.get(label);
                    if (!colIndex) return;
                    Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).forEach((row) => {
                        const value = row.querySelector(`td:nth-child(${colIndex})`)?.textContent?.trim();
                        if (value) values.add(value);
                    });
                });
                const options = preserveDocOrder ? Array.from(values) : Array.from(values).sort();

                const { field, select } = makeFilterSelect(label, options);
                filterBar.appendChild(field);
                selectsByLabel.set(label, select);
            });

            mountFilterBar(filterBar, documentView);

            const applyFilters = () => {
                const breakingOnly = breakingCheckbox?.checked ?? false;

                releaseNotesTables.forEach((table) => {
                    const colIndexByLabel = columnIndexByTable.get(table);
                    const rows = Array.from(table.querySelectorAll<HTMLElement>('tbody tr'));
                    let anyRowVisible = false;

                    rows.forEach((row) => {
                        const matches = Array.from(selectsByLabel.entries()).every(([label, select]) => {
                            const filterValue = select.value;
                            if (!filterValue) return true; // "All"
                            const colIndex = colIndexByLabel?.get(label);
                            if (!colIndex) return true; // table doesn't author this column — not excluded by it
                            const rowValue = row.querySelector(`td:nth-child(${colIndex})`)?.textContent?.trim() || '';
                            return rowValue === filterValue;
                        });
                        row.style.display = matches ? '' : 'none';
                        if (matches) anyRowVisible = true;
                    });

                    const sect2 = table.closest<HTMLElement>('.sect2');
                    if (sect2) sect2.dataset.hasVisibleRows = anyRowVisible ? 'true' : 'false';
                });

                document.querySelectorAll<HTMLElement>('.sect2').forEach((sect2) => {
                    const heading = getHeadingText(sect2.querySelector('h3')).toLowerCase();
                    const isBreakingSection = heading === 'breaking changes';

                    let visible = true;
                    if (breakingOnly && !isBreakingSection) visible = false;
                    if (sect2.dataset.hasVisibleRows === 'false') visible = false;

                    sect2.style.display = visible ? '' : 'none';
                });

                document.querySelectorAll<HTMLElement>('.sect1').forEach((sect1) => {
                    const sect2s = Array.from(sect1.querySelectorAll<HTMLElement>('.sect2'));
                    const anySect2Visible = sect2s.some((s) => s.style.display !== 'none');
                    sect1.style.display = sect2s.length && !anySect2Visible ? 'none' : '';
                });
            };

            selectsByLabel.forEach((select) => select.addEventListener('change', applyFilters));
            breakingCheckbox?.addEventListener('change', applyFilters);
        }
    }

    releaseNotesTables.forEach((table) => {
        if (table.dataset.releaseNotesInit) return;
        table.dataset.releaseNotesInit = 'true';

        // Opt-out modifier — [.release-notes-table.release-notes-static] —
        // for pages that want the full Description text always visible,
        // with no clip/blur/"Show more" interaction at all (e.g. a long-form
        // reference page rather than a terse weekly view).
        if (table.classList.contains('release-notes-static')) return;

        const rows = Array.from(table.querySelectorAll<HTMLElement>('tbody tr'));

        rows.forEach((row) => {
            const cell = row.querySelector<HTMLElement>('td:first-child');
            if (!cell || cell.classList.contains('release-notes-desc-processed')) return;
            cell.classList.add('release-notes-desc-processed');

            const inner = cell.querySelector<HTMLElement>(':scope > .content') || cell;
            inner.classList.add('release-notes-desc');

            if (inner.scrollHeight <= inner.clientHeight + 2) return;

            cell.classList.add('has-overflow');

            const expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.classList.add('release-notes-more-btn');
            expandBtn.textContent = 'Show more';
            expandBtn.addEventListener('click', () => {
                const isExpanded = cell.classList.toggle('expanded');
                expandBtn.textContent = isExpanded ? 'Show less' : 'Show more';
            });
            cell.appendChild(expandBtn);
        });
    });

    /*
     * Badge-style weekly release-notes pages — the original production
     * format: a colored Fix/Enhancement/New feature badge plus a
     * description, one small table per entry, grouped under a date (h2)
     * and an optional feature-category heading (h3). This is NOT the
     * [.release-notes-table] role above, so it needs its own detection:
     * an entry is anything containing one of the known badge classes.
     * Feature category comes from the nearest enclosing h3 (.sect2), or
     * "General" for entries that sit directly under the date heading.
     * A page-level filter bar (Feature category + Type) is built the same
     * way as the one above, and both bars are sticky (see index.scss) so
     * they stay in view while a long page like this one scrolls.
     */
    const BADGE_TYPES: Record<string, string> = {
        'badge-fix-relnotes': 'Fix',
        'badge-enhance-relnotes': 'Enhancement',
        'badge-new-relnotes': 'New feature',
    };

    type BadgeEntry = { table: HTMLElement; type: string; category: string; group: HTMLElement };

    const badgeEntries: BadgeEntry[] = Array.from(
        document.querySelectorAll<HTMLElement>(Object.keys(BADGE_TYPES).map((cls) => `.${cls}`).join(', ')),
    )
        .map((badge): BadgeEntry | null => {
            const table = badge.closest<HTMLElement>('table');
            if (!table) return null;
            const typeClass = Object.keys(BADGE_TYPES).find((cls) => badge.classList.contains(cls));
            if (!typeClass) return null;
            const sect2 = table.closest<HTMLElement>('.sect2');
            const category = getHeadingText(sect2?.querySelector('h3')) || 'General';
            return { table, type: BADGE_TYPES[typeClass], category, group: sect2 || table };
        })
        .filter((entry): entry is BadgeEntry => !!entry);

    if (badgeEntries.length) {
        const documentView = document.querySelector<HTMLElement>('.documentView');

        if (documentView) {
            const categories = Array.from(new Set(badgeEntries.map((entry) => entry.category))).sort();
            const types = ['Fix', 'Enhancement', 'New feature'];

            const filterBar = document.createElement('div');
            filterBar.classList.add('release-notes-filterbar', 'badge-relnotes-filterbar');

            const { field: categoryField, select: categorySelect } = makeFilterSelect('Feature', categories);
            const { field: typeField, select: typeSelect } = makeFilterSelect('Type', types);

            filterBar.appendChild(categoryField);
            filterBar.appendChild(typeField);

            mountFilterBar(filterBar, documentView);

            const applyBadgeFilters = () => {
                const category = categorySelect.value;
                const type = typeSelect.value;

                const groupHasVisibleEntry = new Map<HTMLElement, boolean>();

                badgeEntries.forEach((entry) => {
                    const matches = (!category || entry.category === category) && (!type || entry.type === type);
                    entry.table.style.display = matches ? '' : 'none';
                    if (matches) groupHasVisibleEntry.set(entry.group, true);
                });

                document.querySelectorAll<HTMLElement>('.sect2').forEach((sect2) => {
                    if (!groupHasVisibleEntry.has(sect2) && badgeEntries.some((e) => e.group === sect2)) {
                        sect2.style.display = 'none';
                    } else if (badgeEntries.some((e) => e.group === sect2)) {
                        sect2.style.display = '';
                    }
                });

                document.querySelectorAll<HTMLElement>('.sect1').forEach((sect1) => {
                    const relevant = badgeEntries.filter((e) => sect1.contains(e.table));
                    const anyVisible = relevant.some(
                        (e) => e.table.style.display !== 'none' && (e.group === e.table || e.group.style.display !== 'none'),
                    );
                    sect1.style.display = relevant.length && !anyVisible ? 'none' : '';
                });
            };

            categorySelect.addEventListener('change', applyBadgeFilters);
            typeSelect.addEventListener('change', applyBadgeFilters);
        }
    }
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
