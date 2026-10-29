import React from 'react';
import hljs from 'highlight.js';
import { MdContentCopy } from '@react-icons/all-files/md/MdContentCopy';
import { MdCheck } from '@react-icons/all-files/md/MdCheck';
import { MdFilterList } from '@react-icons/all-files/md/MdFilterList';
import { BiSearch } from '@react-icons/all-files/bi/BiSearch';
import { MdClear } from '@react-icons/all-files/md/MdClear';
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

/* A release-notes description cell can itself contain a table. A plain
 * `table.querySelectorAll('tbody tr')` or `row.querySelector('td:nth-child(n)')`
 * then descends into it — treating a nested row as a release row, and
 * returning a nested cell where the row's own Topic/State cell was meant.
 * These look at the table's own rows and a row's own cells only. */
const bodyRows = (table: HTMLTableElement): HTMLTableRowElement[] =>
    Array.from(table.tBodies).flatMap((body) => Array.from(body.rows));
const cellText = (row: HTMLElement, colIndex: number): string =>
    (row as HTMLTableRowElement).cells[colIndex - 1]?.textContent ?? '';
// A row's Topic is the bold label (`[.release-notes-topic]`) at the top of its
// first cell, not a hidden column — the same text readers see is what the
// tabs and the Topic filter match on.
const rowTopics = (row: HTMLElement): string[] =>
    ((row as HTMLTableRowElement).cells[0]?.querySelector('.release-notes-topic')?.textContent ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

/* On a release-notes-no-header table (e.g. a master list grouping several
 * entries under one date+version), blank out column 1 on every row after
 * the first in a run of rows sharing the same `data-date-key` — a
 * multi-item release then shows its header once instead of once per row.
 * `data-date-key` is set once, from the cell's original text, by the
 * releaseNotesColsInit pass in customizeDocContent; this function only
 * toggles the `.release-notes-date-repeat` class, and does it against
 * *currently visible* rows only, so it's safe to re-run after every filter
 * change — a row that becomes the first visible member of its group always
 * gets its header shown, even if it was row 2 or 3 before filtering. */
const dedupeDateColumn = (table: HTMLTableElement) => {
    const rows = bodyRows(table);
    rows.forEach((row) => {
        const cell = row.cells[0];
        if (!cell || !cell.dataset.dateKey) return;
        cell.style.display = '';
        cell.rowSpan = 1;
        cell.classList.remove('release-notes-date-repeat');
    });

    // Merge each run of consecutive visible rows that share the same label
    // into ONE tall cell: the first row's cell spans the run, and the later
    // rows' own first cells are hidden (kept in the DOM, so column indexes
    // elsewhere don't shift). A tall cell is what lets the sticky label stay
    // in view while the whole run scrolls past — a label confined to its own
    // short row would scroll away with it.
    let lead: HTMLTableCellElement | null = null;
    let leadKey: string | null = null;
    rows.forEach((row) => {
        if (row.style.display === 'none') return;
        const cell = row.cells[0];
        if (!cell || !cell.dataset.dateKey) return;
        if (lead && cell.dataset.dateKey === leadKey) {
            cell.style.display = 'none';
            cell.classList.add('release-notes-date-repeat');
            lead.rowSpan += 1;
        } else {
            lead = cell;
            leadKey = cell.dataset.dateKey;
        }
    });
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

/* Horizontal alternative to makeFilterSelect — a row of always-visible tab
 * buttons (All + one per option), label-less (the options are the label),
 * for a dimension with few enough values that forcing a click-to-open menu
 * just adds a step (e.g. a 2-way Feature split). Returns the same
 * { field, select } shape as makeFilterSelect — `select` isn't a real
 * <select>, but exposes a `.value` getter and is a real EventTarget, so the
 * generic `select.value` / `select.addEventListener('change', ...)` call
 * sites in applyFilters work unmodified either way. */
const makeFilterToggle = (label: string, options: string[]) => {
    const field = document.createElement('div');
    field.classList.add('release-notes-filterbar-togglegroup');

    const pills = document.createElement('div');
    pills.classList.add('release-notes-filterbar-pills');
    field.appendChild(pills);

    let currentValue = '';
    const buttons: HTMLButtonElement[] = [];

    const setActive = (target: HTMLButtonElement) => {
        buttons.forEach((b) => b.classList.toggle('active', b === target));
    };

    const makePill = (text: string, value: string) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('release-notes-filterbar-pill');
        btn.setAttribute('aria-label', value ? `Filter by ${label}: ${value}` : `Filter by ${label}: All`);
        btn.textContent = text;
        btn.addEventListener('click', () => {
            currentValue = value;
            setActive(btn);
            field.dispatchEvent(new Event('change'));
        });
        buttons.push(btn);
        pills.appendChild(btn);
        return btn;
    };

    setActive(makePill('All', ''));
    options.forEach((option) => makePill(option, option));

    Object.defineProperty(field, 'value', { get: () => currentValue });

    return { field, select: field as unknown as HTMLSelectElement };
};

/* Icon-triggered panel alternative to makeFilterSelect — a funnel-icon
 * button that opens a menu of one or more multi-select checkbox sections,
 * for a dimension (or group of dimensions) with too many values to spell
 * out as tabs or a labelled <select> (e.g. Category, which grows every
 * release), or that explicitly calls for checking more than one value at
 * once (e.g. Topic + State on the "All" tab's page). One section per
 * `{ label, options }` entry; a page that only has one such dimension
 * (e.g. just Category) gets a one-section panel. Unlike makeFilterSelect/
 * makeFilterToggle, there's no single `.value` — callers read
 * `getSelectedValues(label)` per section instead, since more than one
 * option can be checked at a time. */
const makeFilterPanel = (
    sections: Array<{ label: string; options: string[]; heading?: string; single?: boolean }>,
    initial: Record<string, string[]> = {},
) => {
    const field = document.createElement('div');
    field.classList.add('release-notes-filterbar-icondropdown');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.classList.add('release-notes-filterbar-icontrigger');
    trigger.setAttribute('aria-label', `Filter by ${sections.map((s) => s.label).join(', ')}`);

    const triggerLabel = document.createElement('span');
    triggerLabel.textContent = 'Filter';
    trigger.appendChild(triggerLabel);

    const triggerIcon = document.createElement('span');
    triggerIcon.classList.add('release-notes-filterbar-icontrigger-icon');
    triggerIcon.innerHTML = getHTMLFromComponent(<MdFilterList />, 'release-notes-filter-icon');
    trigger.appendChild(triggerIcon);

    field.appendChild(trigger);

    const badge = document.createElement('span');
    badge.classList.add('release-notes-filterbar-icon-badge');
    badge.hidden = true;
    trigger.appendChild(badge);

    const menu = document.createElement('div');
    menu.classList.add('release-notes-filterbar-icon-menu');
    field.appendChild(menu);

    const closeMenu = () => menu.classList.remove('open');
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!field.contains(e.target as Node)) closeMenu();
    });

    const selectedBySection = new Map<string, Set<string>>();
    sections.forEach(({ label }) => selectedBySection.set(label, new Set()));

    const updateActiveState = () => {
        const total = Array.from(selectedBySection.values()).reduce((n, set) => n + set.size, 0);
        trigger.classList.toggle('active', total > 0);
        badge.hidden = total === 0;
        badge.textContent = String(total);
    };

    sections.forEach(({ label, options, heading: headingText, single }) => {
        // One column per section, so a panel with several (Topic, State,
        // Month, ...) reads as a wide grid rather than one tall list.
        const sectionEl = document.createElement('div');
        sectionEl.classList.add('release-notes-filterbar-panel-section');
        menu.appendChild(sectionEl);

        // A one-section panel (just Category, on most pages) skips the
        // heading — the trigger's own aria-label already says what it
        // filters, a repeated heading would be redundant.
        if (sections.length > 1) {
            const heading = document.createElement('div');
            heading.classList.add('release-notes-filterbar-panel-heading');
            heading.textContent = `Filter by ${headingText ?? label.toLowerCase()}`;
            sectionEl.appendChild(heading);
        }

        options.forEach((option) => {
            const optionRow = document.createElement('label');
            optionRow.classList.add('release-notes-filterbar-icon-option');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            // Restore a selection carried over from before a rebuild.
            if (initial[label]?.includes(option)) {
                checkbox.checked = true;
                selectedBySection.get(label)!.add(option);
            }
            checkbox.addEventListener('change', () => {
                const selected = selectedBySection.get(label)!;
                // A "single" section behaves like a set of radio buttons (but
                // can be unchecked again): checking one clears the others.
                if (single && checkbox.checked) {
                    selected.clear();
                    sectionEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((other) => {
                        if (other !== checkbox) other.checked = false;
                    });
                }
                if (checkbox.checked) selected.add(option); else selected.delete(option);
                updateActiveState();
                field.dispatchEvent(new Event('change'));
            });

            const text = document.createElement('span');
            text.textContent = option;

            optionRow.appendChild(checkbox);
            optionRow.appendChild(text);
            sectionEl.appendChild(optionRow);
        });
    });

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.classList.add('release-notes-filterbar-panel-clear');
    clearButton.textContent = 'Clear all';
    clearButton.addEventListener('click', () => {
        selectedBySection.forEach((set) => set.clear());
        menu.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
            checkbox.checked = false;
        });
        updateActiveState();
        field.dispatchEvent(new Event('change'));
    });
    menu.appendChild(clearButton);

    const getSelectedValues = (label: string): string[] => Array.from(selectedBySection.get(label) ?? []);
    updateActiveState();

    return { field, getSelectedValues };
};

/* Free-text search box for the filter bar — matches against a row's full
 * (visible) text, not a single column, so it catches a hit in the
 * description, date, version, or category alike. Debounced in
 * customizeDocContent (not here) since this is just the field itself. */
const makeFilterSearch = () => {
    const field = document.createElement('label');
    field.classList.add('release-notes-filterbar-search');

    const icon = document.createElement('span');
    icon.classList.add('release-notes-filterbar-search-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = getHTMLFromComponent(<BiSearch />, 'release-notes-search-icon-svg');
    field.appendChild(icon);

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search';
    input.setAttribute('aria-label', 'Search release notes');
    field.appendChild(input);

    // The x at the right end, shown while the box has text (same as the
    // search box on the generated Action reference page).
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.classList.add('release-notes-filterbar-search-clear');
    clear.setAttribute('aria-label', 'Clear the search text');
    clear.innerHTML = getHTMLFromComponent(<MdClear />, 'release-notes-search-clear-svg');
    const syncClear = () => clear.classList.toggle('is-visible', input.value !== '');
    input.addEventListener('input', syncClear);
    clear.addEventListener('click', () => {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
    });
    field.appendChild(clear);
    syncClear();

    return { field, input, syncClear };
};

// customizeDocContent() reruns on every page navigation in this SPA and
// rebuilds the filter bar from scratch — without this, each run's
// scroll/resize listeners would pile up on `window` forever, each one
// still holding a closure over its (by-then-detached) filterBar/spacer
// from a page the user already left.
let teardownFilterBarListeners: (() => void) | null = null;

/* Mounts a release-notes filter bar right after the page's own <h1> (and
 * its intro paragraph, if it has one), and pins the whole stack
 * immediately — title, then the intro blurb, then the bar, all
 * `position: fixed` from first render, never toggled by scroll position.
 * Everything else on the page (a template's "Release version"/"Upgrade
 * notes" metadata block, etc.) stays normal scrolling content, right
 * below the pinned stack's spacer.
 *
 * The intro paragraph is whatever plain paragraph immediately follows the
 * title — found either as a direct sibling (a page with no `==` sections,
 * e.g. a flat master-list page) or inside Asciidoctor's auto-generated
 * `#preamble` (a page that does have sections). A page may also author its
 * own cross-page nav tabs right after that (a `[.release-notes-navtabs]`
 * paragraph of plain xref links — see the tabbed-changelog sample pages);
 * when present, the Category filter bar is appended into it (tabs left,
 * filter right, one row) instead of getting its own tier below, and that
 * combined row becomes the stack's last tier in place of the bar.
 *
 * `top` for the whole stack starts from the title's own natural position
 * (measured once, before anything is pinned) rather than a hardcoded
 * header-height constant — this page's title doesn't start right under
 * the header, there's a breadcrumb row above it first, and a fixed guess
 * at that combined height sat the pinned title exactly on top of the
 * breadcrumbs, hiding them. Measuring the title's actual starting point
 * instead means the stack pins at wherever the title already was, no
 * matter what's above it.
 *
 * Each element's rect is measured up front, in one pass, before any of
 * them become `position: fixed` — fixing one mid-loop reflows the rest
 * (a later sibling slides up into the gap the earlier one just left),
 * which previously corrupted the next element's measured rect and showed
 * up as the intro paragraph (and briefly, the title) rendering clipped or
 * overlapping. Measuring everything first, then applying `fixed` to all
 * of them in a second pass, avoids that reflow entirely.
 *
 * Earlier versions only fixed the bar, left the title in normal flow, and
 * toggled the bar between normal-flow and fixed once scrolled past the
 * title — that either overlapped the title (if fixed from the start,
 * since nothing then reserved the title's own space) or left a growing
 * gap above the bar once scrolled (if the bar's fixed offset assumed the
 * title was still there after it scrolled away). Pinning everything above
 * the bar as one stacked unit is the only way "bar stays fixed, directly
 * below the title/intro" is true both before and after scrolling — so the
 * title (and intro, if present) become fixed here too, scoped to just the
 * pages that reach this function (ones with a release-notes-table filter
 * bar), not every page's title.
 *
 * `position: sticky` was tried instead of `fixed` for the bar and
 * produced a large, unexplained gap above it plus a real layout overlap
 * with the content right after it (tested directly: switching to
 * `static` removes both) — almost certainly because sticky's offset is
 * computed against the nearest scrolling ancestor, not the viewport, and
 * that ancestor's own box doesn't start at viewport (0,0). `fixed`
 * doesn't have that problem, at the cost of needing its own left/width
 * kept in sync on resize (`.documentView`'s own bounding box spans the
 * full viewport width regardless of the visible sidebar — a
 * fixed-position overlay painted on top, not a flex sibling that narrows
 * it — so it can't be used for this; each element's own rect, read once
 * in normal flow before pinning, already reflects the content column's
 * padding).
 *
 * A spacer sized to the pinned stack's combined height sits where the
 * title used to be, so pinning everything doesn't yank the rest of the
 * content upward. */
const mountFilterBar = (filterBar: HTMLElement, documentView: HTMLElement) => {
    const docTitle = documentView.querySelector<HTMLElement>(':scope > h1');
    const introEl = documentView.querySelector<HTMLElement>(
        ':scope > h1 + .paragraph, :scope > #preamble > .paragraph:first-child',
    );
    // Cross-page nav tabs (All / Embed SDK / REST API / MCP Server on the
    // tabbed-changelog sample pages) — plain xref links the page itself
    // authors with a `[.release-notes-navtabs]` block role, not something
    // this code builds. Pinned alongside the title/intro/bar when present,
    // same as the intro paragraph, so the primary "which dataset" nav
    // doesn't scroll away independently of the Category filter beneath it.
    const navTabsEl = documentView.querySelector<HTMLElement>(
        ':scope > .release-notes-navtabs, :scope > #preamble > .release-notes-navtabs',
    );
    const parent = docTitle?.parentNode ?? documentView;

    // When a page has nav tabs, the Category filter bar rides alongside
    // them on the same row (tabs left, filter right) instead of its own
    // row below — matching the single-row look of a page that filters by
    // Feature + Category in one combined bar (e.g.
    // release-notes-embed-master-sample.adoc), since these tabbed pages
    // use the nav tabs themselves as the "which dataset" selector and only
    // need the bar for Category. Appending it as navTabsEl's own child
    // (rather than a document sibling) also means it's not a separate
    // pinned tier below — it's carried along for free as part of
    // navTabsEl's own box once that's pinned.
    if (navTabsEl) {
        navTabsEl.appendChild(filterBar);
    } else {
        const insertionPoint = introEl ? introEl.nextSibling : docTitle ? docTitle.nextSibling : documentView.firstChild;
        parent.insertBefore(filterBar, insertionPoint);
    }

    const spacer = document.createElement('div');
    spacer.classList.add('release-notes-filterbar-spacer');
    parent.insertBefore(spacer, docTitle ?? documentView.firstChild);

    // The Copy-page dropdown (.document-toolbar, a sibling of documentView,
    // not a child of it) is `float: right` in normal flow, riding alongside
    // the title on the same line. Pinning the title takes it out of flow
    // entirely, which strands the float at the top of whatever's left in
    // flow (the breadcrumb) instead of next to the now-fixed title — so it
    // has to be pinned too, aligned to the title's row, or it visually
    // detaches. Not part of `stack` below: it doesn't stack vertically with
    // the title/bar, it sits beside the title, keeping its own float-given
    // left/width and only borrowing the title's pinned `top`.
    const toolbar = document.querySelector<HTMLElement>('.document-toolbar');

    const TITLE_INTRO_GAP = 18;
    const TITLE_CONTROLS_GAP = 12;
    const INTRO_CONTROLS_GAP = 24;
    const stack: Array<{ el: HTMLElement; pinnedClass: string; gapAfter: number }> = [];
    if (docTitle) {
        stack.push({
            el: docTitle,
            pinnedClass: 'release-notes-title-pinned',
            gapAfter: introEl ? TITLE_INTRO_GAP : TITLE_CONTROLS_GAP,
        });
    }
    if (introEl) {
        stack.push({ el: introEl, pinnedClass: 'release-notes-intro-pinned', gapAfter: INTRO_CONTROLS_GAP });
    }
    // navTabsEl, when present, replaces filterBar as the last tier — the
    // bar is its child now (see the `if (navTabsEl)` block above), not a
    // sibling tier of its own.
    stack.push(
        navTabsEl
            ? { el: navTabsEl, pinnedClass: 'release-notes-navtabs-pinned', gapAfter: 0 }
            : { el: filterBar, pinnedClass: 'is-pinned', gapAfter: 0 },
    );

    const pin = () => {
        stack.forEach(({ el, pinnedClass }) => {
            el.classList.remove(pinnedClass);
            el.style.position = '';
            el.style.paddingBottom = '';
            el.style.paddingTop = '';
        });
        if (toolbar) {
            toolbar.classList.remove('document-toolbar-pinned');
            toolbar.style.position = '';
        }

        // One measurement pass, with every element still in normal flow —
        // see the comment above this function for why that matters.
        const toolbarRect = toolbar?.getBoundingClientRect();
        const rects = stack.map(({ el }) => el.getBoundingClientRect());

        // Where the stack starts, in viewport coordinates. Measured from the
        // title's natural position, but only the first time for a given
        // page: a later re-pin (resize, or a tab swap while the page is
        // scrolled) would otherwise measure the title's *scrolled* position
        // and pin the whole stack off-screen/misplaced. A swap doesn't change
        // the pathname, a real navigation does — so that's the cache key.
        const cachedTop = documentView.dataset.releaseNotesPinTop;
        const cachedKey = documentView.dataset.releaseNotesPinKey;
        const stackTop =
            cachedTop !== undefined && cachedKey === window.location.pathname ? Number(cachedTop) : rects[0].top;
        documentView.dataset.releaseNotesPinTop = String(stackTop);
        documentView.dataset.releaseNotesPinKey = window.location.pathname;

        // The title doesn't start flush under the site header (a breadcrumb
        // row sits between them), and that strip isn't covered by anything
        // once the breadcrumb scrolls away — page content scrolling past it
        // showed through above the title. Extend the first pinned box up to
        // the header's bottom edge (its own padding, so its background
        // covers it) instead of leaving a transparent strip.
        const headerBottom = document.querySelector('.secondary-header')?.getBoundingClientRect().bottom;
        const bleed = headerBottom !== undefined && headerBottom > 0 && headerBottom < stackTop ? stackTop - headerBottom : 0;

        let top = stackTop - bleed;
        const titleTop = stackTop;
        stack.forEach(({ el, pinnedClass, gapAfter }, i) => {
            const rect = rects[i];
            el.style.top = `${top}px`;
            el.style.left = `${rect.left}px`;
            el.style.width = `${rect.width}px`;
            el.style.position = 'fixed';
            el.classList.add(pinnedClass);
            // The gap below an element is its own bottom padding rather than
            // empty space between two pinned boxes — each box carries a solid
            // background, but a gap between them has none, and scrolling
            // content showed through it. Padding is covered by the
            // background, so the stack reads as one continuous opaque panel.
            if (gapAfter) el.style.paddingBottom = `${gapAfter}px`;
            if (i === 0 && bleed) {
                el.style.paddingTop = `${parseFloat(getComputedStyle(el).paddingTop) + bleed}px`;
            }
            // Measured after pinning, not before: pinned styling (e.g. the
            // title's extra top padding) changes an element's real height,
            // and fixed boxes don't affect each other's layout so this is
            // safe to read mid-loop.
            top += el.getBoundingClientRect().height;
        });
        const totalHeight = top - stackTop;

        if (toolbar && toolbarRect) {
            toolbar.style.top = `${titleTop}px`;
            toolbar.style.left = `${toolbarRect.left}px`;
            toolbar.style.width = `${toolbarRect.width}px`;
            toolbar.style.position = 'fixed';
            toolbar.classList.add('document-toolbar-pinned');
        }

        spacer.style.height = `${totalHeight}px`;

        // Read by the release-notes table's sticky date/version cell
        // (index.scss). A sticky offset is measured from the scroll
        // container's top edge, so this is the stack's bottom edge relative to
        // that container. Too small and the date sticks underneath the pinned
        // panel; too large (e.g. a viewport coordinate) and, at scroll 0, the
        // left column's text sits lower than the right column's.
        // `position: sticky` offsets are measured from the scrolling container's
        // top edge, not the viewport's — subtract where that container starts.
        const scrollerTop = documentView.closest<HTMLElement>('.documentWrapperContainer')?.getBoundingClientRect().top ?? 0;
        documentView.style.setProperty('--release-notes-pinned-stack-height', `${top - scrollerTop}px`);
    };

    pin();
    window.addEventListener('resize', pin);

    teardownFilterBarListeners = () => {
        window.removeEventListener('resize', pin);
        stack.forEach(({ el, pinnedClass }) => {
            el.classList.remove(pinnedClass);
            el.style.position = '';
            el.style.paddingBottom = '';
            el.style.paddingTop = '';
        });
        if (toolbar) {
            toolbar.classList.remove('document-toolbar-pinned');
            toolbar.style.position = '';
        }
    };

    if (navTabsEl) wireNavTabs(navTabsEl, documentView);
};

let teardownNavTabListeners: (() => void) | null = null;

/* Filter state for a release-notes page — what's checked in the Filter
 * panel, plus the search text — kept on `documentView` (keyed by pathname,
 * since that element is reused across page navigations) so it survives the
 * rebuild customizeDocContent() does whenever the panel's own shape changes
 * (e.g. picking a topic adds a Category section).
 *
 * The tabs on the What's new page (All / Embed SDK / REST API / ...) are
 * not separate pages: they're a shortcut onto the Topic filter. Exactly one
 * topic checked = that topic's tab is active; none, or two or more = "All".
 * That is why checking a first topic makes its tab light up, and checking a
 * second one drops back to "All" with both still applied. A tab can be linked
 * to directly (#tab-embed-sdk). */
type FilterState = {
    Topic: string[];
    Category: string[];
    State: string[];
    Period: string[];
    search: string;
};

const tabTopic = (link: HTMLAnchorElement): string => {
    const label = link.textContent?.trim() ?? '';
    return label === 'All' ? '' : label;
};

const tabLinks = (navTabsEl: HTMLElement) => Array.from(navTabsEl.querySelectorAll<HTMLAnchorElement>('a'));

const activeTopicOf = (state: FilterState): string => (state.Topic.length === 1 ? state.Topic[0] : '');

const readFilterState = (documentView: HTMLElement, navTabsEl?: HTMLElement | null): FilterState => {
    const empty: FilterState = { Topic: [], Category: [], State: [], Period: [], search: '' };
    if (documentView.dataset.releaseNotesFilters && documentView.dataset.releaseNotesFiltersKey === window.location.pathname) {
        try {
            return { ...empty, ...JSON.parse(documentView.dataset.releaseNotesFilters) };
        } catch (e) {
            return empty;
        }
    }
    const { hash } = window.location;
    const link = hash && navTabsEl ? tabLinks(navTabsEl).find((a) => a.hash === hash) : undefined;
    return link && tabTopic(link) ? { ...empty, Topic: [tabTopic(link)] } : empty;
};

const writeFilterState = (documentView: HTMLElement, state: FilterState) => {
    documentView.dataset.releaseNotesFilters = JSON.stringify(state);
    documentView.dataset.releaseNotesFiltersKey = window.location.pathname;
};

/* Replace the Topic selection and rebuild. Category is always dropped (it
 * belongs to whichever single topic was active). When the change comes from
 * the Topic checkboxes crossing between "exactly one" and not, State/Period/
 * search are kept; a tab click is a fresh view of that topic, so it clears
 * them too (`fresh`). */
const selectTopics = (
    documentView: HTMLElement,
    navTabsEl: HTMLElement | null,
    topics: string[],
    { keepHash = false, fresh = false } = {},
) => {
    const base: FilterState = fresh
        ? { Topic: [], Category: [], State: [], Period: [], search: '' }
        : readFilterState(documentView, navTabsEl);
    writeFilterState(documentView, { ...base, Topic: topics, Category: [] });
    if (!keepHash && navTabsEl) {
        const link = tabLinks(navTabsEl).find((a) => topics.length === 1 && tabTopic(a) === topics[0]);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${link?.hash ?? ''}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    customizeDocContent();
};

const wireNavTabs = (navTabsEl: HTMLElement, documentView: HTMLElement) => {
    const active = activeTopicOf(readFilterState(documentView, navTabsEl));
    tabLinks(navTabsEl).forEach((a) => {
        a.classList.toggle('active', tabTopic(a) === active);
    });

    const onClick = (e: MouseEvent) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a');
        if (!link || !navTabsEl.contains(link)) return;
        e.preventDefault();
        const topic = tabTopic(link);
        if (topic === activeTopicOf(readFilterState(documentView, navTabsEl))) return;
        selectTopics(documentView, navTabsEl, topic ? [topic] : [], { fresh: true });
    };

    navTabsEl.addEventListener('click', onClick);
    teardownNavTabListeners = () => navTabsEl.removeEventListener('click', onClick);
};

export const customizeDocContent = () => {
    /* Tear down the previous page's filter bar listeners (see
     * teardownFilterBarListeners above) before removing its DOM, and
     * defensively clear any leftover filter bar and its spacer (e.g. React
     * 18 double-invoking this effect in dev, or a tab change re-running
     * this function on demand — see selectTopics) — rebuilt fresh
     * below if the current page needs one. Forgetting the spacer here
     * previously meant every extra run stacked another one on top of the
     * last, growing a blank gap above the title each time. */
    teardownFilterBarListeners?.();
    teardownFilterBarListeners = null;
    document
        .querySelectorAll('.release-notes-filterbar, .release-notes-filterbar-spacer, .release-notes-loadmore, .release-notes-empty-state')
        .forEach((el) => el.remove());

    // Nav-tab click listener (see wireNavTabs) — same re-run story: torn
    // down and re-attached fresh each time, including the re-run a tab
    // change triggers.
    teardownNavTabListeners?.();
    teardownNavTabListeners = null;

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
    // `.release-notes-table table` also matches any table nested inside a
    // description cell of a `table.release-notes-table` — those aren't
    // release-notes tables (no header columns, no filters), so skip any table
    // that sits inside another one.
    const releaseNotesTables = Array.from(
        document.querySelectorAll<HTMLTableElement>(
            '.release-notes-table table, table.release-notes-table',
        ),
    ).filter((table) => !table.parentElement?.closest('table.release-notes-table'));

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

        // A table authored with `.release-notes-sorted` is assembled from
        // several partials (one per topic and year) that are each written
        // newest-first on their own — so the combined row order is "all of
        // topic A, then all of topic B". Sort the whole table newest-first
        // by each row's date, and tag every row with its month (used by the
        // Month filter and by month-based "Load more"). Ties on date keep
        // rows with an identical date+version label together (so their
        // shared left-hand label still collapses to one), then fall back to
        // authored order. Runs once per table, before anything reads row
        // order (date dedupe below, filter option order).
        const MONTH_INDEX: Record<string, number> = {
            January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
            July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
        };
        releaseNotesTables.forEach((table) => {
            if (!table.classList.contains('release-notes-sorted') || table.dataset.releaseNotesSorted) return;
            table.dataset.releaseNotesSorted = 'true';
            const tbody = table.tBodies[0];
            if (!tbody) return;

            const labelFirstSeen = new Map<string, number>();
            const sortable = Array.from(tbody.rows).map((row, index) => {
                const cell = row.cells[0];
                const dateText = cell?.querySelector('.release-notes-date')?.textContent?.trim() ?? '';
                const versionText = cell?.querySelector('.release-notes-version')?.textContent?.trim() ?? '';
                const match = dateText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
                const monthIndex = match ? MONTH_INDEX[match[1]] : undefined;
                const time = match && monthIndex !== undefined ? Date.UTC(Number(match[3]), monthIndex, Number(match[2])) : 0;
                if (match) {
                    row.dataset.month = `${match[1]} ${match[3]}`;
                    if (monthIndex !== undefined) row.dataset.monthIndex = String(Number(match[3]) * 12 + monthIndex);
                }
                const topicText = cell?.querySelector('.release-notes-topic')?.textContent?.trim() ?? '';
                const label = `${topicText}|${dateText}|${versionText}`;
                if (!labelFirstSeen.has(label)) labelFirstSeen.set(label, index);
                return { row, index, time, labelRank: labelFirstSeen.get(label) as number };
            });
            sortable.sort((a, b) => b.time - a.time || a.labelRank - b.labelRank || a.index - b.index);
            sortable.forEach(({ row }) => tbody.appendChild(row));
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

            bodyRows(table).forEach((row) => {
                const cells = Array.from(row.cells);
                cells.forEach((td, i) => {
                    if (hiddenIndices.has(i + 1)) td.style.display = 'none';
                });
                const visibleCells = cells.filter((_, i) => !hiddenIndices.has(i + 1));
                visibleCells.forEach((td, i) => {
                    td.style.borderRight = i === visibleCells.length - 1 ? 'none' : '';
                });
            });

            if (table.classList.contains('release-notes-no-header')) {
                bodyRows(table).forEach((row) => {
                    const cell = row.cells[0];
                    if (cell) cell.dataset.dateKey = cell.textContent?.trim() || '';
                });
                dedupeDateColumn(table);
            }
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

            // Filter state carried over from before a rebuild (see
            // FilterState). The tabs, if this page has them, are a view onto
            // its Topic selection: exactly one topic = that tab is active.
            const tabsEl = documentView.querySelector<HTMLElement>(
                ':scope > .release-notes-navtabs, :scope > #preamble > .release-notes-navtabs',
            );
            const savedState = readFilterState(documentView, tabsEl);
            const activeTopic = activeTopicOf(savedState);
            const hasTopics = releaseNotesTables.some((table) => bodyRows(table).some((row) => rowTopics(row).length));
            const splitCell = (value: string | null | undefined) =>
                (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
            // Rows within the chosen topic(s) — what the Category/State/Month
            // options are offered from (no point listing a category the
            // selected topic has no rows for).
            const inScope = (table: HTMLTableElement, row: HTMLElement) => {
                if (!savedState.Topic.length) return true;
                const topics = rowTopics(row);
                return savedState.Topic.some((topic) => topics.includes(topic));
            };

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

            // Every dimension exposes the same { getValues(): string[] }
            // shape regardless of which widget backs it — a native <select>
            // or the Feature toggle group only ever returns zero or one
            // value, the Category/Topic/State panel can return several at
            // once (multi-select) — so applyFilters below can treat every
            // dimension identically rather than special-casing multi-select.
            const selectsByLabel = new Map<
                string,
                { getValues: () => string[]; rowValues?: (row: HTMLElement) => string[] }
            >();
            const changeTargets: EventTarget[] = [];

            if (hasProductColumn) {
                const { field, select } = makeFilterSelect('Product', PRODUCTS);
                filterBar.appendChild(field);
                selectsByLabel.set('Product', { getValues: () => (select.value ? [select.value] : []) });
                changeTargets.push(select);
            }

            // Category, Topic, and State (and the search box below) read as
            // secondary, "narrow it further" actions — grouped together and
            // pushed to the far right of the bar, away from the primary
            // Feature tabs and other dropdowns on the left (see
            // .release-notes-filterbar-controls in index.scss). Category/
            // Topic/State specifically share ONE funnel-icon panel (see
            // makeFilterPanel) rather than one button each — a page authors
            // either just Category (the three per-feature tabbed-sample
            // pages, release-notes-embed-master-sample) or just Topic +
            // State (the "All" tab), never more than one of these three at
            // once today, but the panel supports any combination.
            const rightControls = document.createElement('div');
            rightControls.classList.add('release-notes-filterbar-controls');
            const PANEL_DIMENSIONS = ['category', 'topic', 'state'];
            const panelSections: Array<{ label: string; options: string[]; heading?: string; single?: boolean }> = [];

            dimensionLabels.forEach((label) => {
                // Version reads newest-first, matching how these pages are
                // already authored, rather than alphabetically — a lexical
                // sort would put "1.10.0" ahead of "1.9.0".
                const preserveDocOrder = label.toLowerCase() === 'version';
                const lowerLabel = label.toLowerCase();

                // Category (the finer split within one topic) only makes
                // sense once exactly one topic is chosen — on "All", or with
                // several topics picked, it isn't offered.
                if (hasTopics && lowerLabel === 'category' && !activeTopic) return;

                const values = new Set<string>();
                releaseNotesTables.forEach((table) => {
                    const colIndex = columnIndexByTable.get(table)?.get(label);
                    if (!colIndex) return;
                    bodyRows(table).forEach((row) => {
                        // Only offer values that exist in the active tab.
                        if (!inScope(table, row)) return;
                        // A cell can carry more than one value (e.g. Topic:
                        // "Embed SDK, REST API") — each still needs to show
                        // up once as its own option in the filter.
                        splitCell(cellText(row, colIndex)).forEach((v) => values.add(v));
                    });
                });
                let options = preserveDocOrder ? Array.from(values) : Array.from(values).sort();
                // Fixed, meaningful orders rather than alphabetical: states
                // by lifecycle, topics in the order the tabs are laid out.
                const preferredOrder = lowerLabel === 'state' ? ['Beta', 'GA', 'Sunset/Deprecated'] : [];
                // "New" is the default for every entry (everything on this page is
                // new, improvements included), so it isn't offered as a filter.
                if (lowerLabel === 'state') options = options.filter((v) => v !== 'New');
                if (preferredOrder.length) {
                    options = [
                        ...preferredOrder.filter((v) => values.has(v)),
                        ...options.filter((v) => !preferredOrder.includes(v)),
                    ];
                }

                if (PANEL_DIMENSIONS.includes(lowerLabel)) {
                    if (options.length) panelSections.push({ label, options });
                    return;
                }

                // "Feature" is always a small, fixed-feeling split (e.g.
                // Embed SDK vs REST API) — a row of always-visible tabs
                // reads faster than a dropdown for 2-3 options. Every other
                // non-panel dimension (Product, Version, ...) keeps the
                // plain single-select dropdown.
                const { field, select } =
                    lowerLabel === 'feature' ? makeFilterToggle(label, options) : makeFilterSelect(label, options);
                filterBar.appendChild(field);
                selectsByLabel.set(label, { getValues: () => (select.value ? [select.value] : []) });
                changeTargets.push(select);
            });

            // Topic comes from each row's bold label rather than a column, so
            // it's added here, in the order the tabs are laid out.
            if (hasTopics) {
                const present = new Set<string>();
                releaseNotesTables.forEach((table) => {
                    bodyRows(table).forEach((row) => rowTopics(row).forEach((topic) => present.add(topic)));
                });
                const tabOrder = tabsEl ? tabLinks(tabsEl).map(tabTopic).filter(Boolean) : [];
                panelSections.push({
                    label: 'Topic',
                    options: [
                        ...tabOrder.filter((topic) => present.has(topic)),
                        ...Array.from(present).filter((topic) => !tabOrder.includes(topic)).sort(),
                    ],
                });
            }

            // One "status" section covers both the State column (New / Beta /
            // GA / Sunset-Deprecated) and "Breaking changes" — rows carrying the
            // Breaking badge (`[.version-badge.breaking]#Breaking#` in the
            // heading or text). Checked values OR together, like any other
            // section, so Beta + Breaking changes shows rows that are either.
            const isBreaking = (row: HTMLElement) => Boolean(row.querySelector('.version-badge.breaking'));
            const hasBreaking = releaseNotesTables.some((table) => bodyRows(table).some(isBreaking));
            let stateSection = panelSections.find((section) => section.label === 'State');
            if (hasBreaking) {
                if (!stateSection) {
                    stateSection = { label: 'State', options: [] };
                    panelSections.push(stateSection);
                }
                stateSection.options.push('Breaking changes');
            }
            if (stateSection) stateSection.heading = 'status';

            // A "sorted" table (see the sort pass above) gets a Period filter:
            // how recent an entry is, counted back from the newest release on
            // the page (not from today, so it doesn't go empty between
            // releases). One choice at a time — the options overlap on purpose
            // (the latest release is also within the last 3 months). Picking an
            // exact month is left to the search box, which matches dates.
            const PERIOD_OPTIONS = ['This month', 'Last month', 'Last 3 months', 'Last 6 months'];
            const monthIndexes = releaseNotesTables.flatMap((table) =>
                bodyRows(table).map((row) => Number(row.dataset.monthIndex)).filter((n) => Number.isFinite(n)),
            );
            const newestMonthIndex = monthIndexes.length ? Math.max(...monthIndexes) : undefined;
            const periodsOf = (row: HTMLElement): string[] => {
                const rowIndex = Number(row.dataset.monthIndex);
                if (newestMonthIndex === undefined || !Number.isFinite(rowIndex)) return [];
                const age = newestMonthIndex - rowIndex;
                return [
                    ...(age === 0 ? ['This month'] : []),
                    ...(age === 1 ? ['Last month'] : []),
                    ...(age <= 2 ? ['Last 3 months'] : []),
                    ...(age <= 5 ? ['Last 6 months'] : []),
                ];
            };
            if (newestMonthIndex !== undefined) {
                panelSections.push({ label: 'Period', options: PERIOD_OPTIONS, heading: 'period', single: true });
            }
            const SECTION_RANK: Record<string, number> = { topic: 0, category: 1, state: 2, period: 3 };
            panelSections.sort((a, b) => (SECTION_RANK[a.label.toLowerCase()] ?? 9) - (SECTION_RANK[b.label.toLowerCase()] ?? 9));

            if (panelSections.length) {
                const { field, getSelectedValues } = makeFilterPanel(panelSections, {
                    Topic: savedState.Topic,
                    Category: savedState.Category,
                    State: savedState.State,
                    Period: savedState.Period,
                });
                rightControls.appendChild(field);
                panelSections.forEach(({ label }) => {
                    selectsByLabel.set(label, {
                        getValues: () => getSelectedValues(label),
                        ...(label === 'Period' ? { rowValues: periodsOf } : {}),
                        ...(label === 'Topic' ? { rowValues: rowTopics } : {}),
                        ...(label === 'State'
                            ? {
                                  rowValues: (row: HTMLElement) => {
                                      const stateIndex = columnIndexByTable.get(row.closest('table') as HTMLTableElement)?.get('State');
                                      return [
                                          ...(stateIndex ? splitCell(cellText(row, stateIndex)) : []),
                                          ...(isBreaking(row) ? ['Breaking changes'] : []),
                                      ];
                                  },
                              }
                            : {}),
                    });
                });

                // Remember what's checked so a rebuild (below) can restore it.
                const persistState = () => {
                    const next = readFilterState(documentView, tabsEl);
                    (['Topic', 'Category', 'State', 'Period'] as const).forEach((label) => {
                        if (panelSections.some((section) => section.label === label)) next[label] = getSelectedValues(label);
                    });
                    writeFilterState(documentView, next);
                    return next;
                };

                // A change is a plain filter — except when it moves the Topic
                // selection into or out of "exactly one", which changes which
                // tab is active and whether the panel has a Category section;
                // that needs the panel rebuilt, not just re-filtered.
                field.addEventListener('change', () => {
                    const next = persistState();
                    if (tabsEl && panelSections.some((section) => section.label === 'Topic') && activeTopicOf(next) !== activeTopic) {
                        selectTopics(documentView, tabsEl, next.Topic);
                        return;
                    }
                    applyFilters(true);
                });
            }

            const { field: searchField, input: searchInput, syncClear } = makeFilterSearch();
            searchInput.value = savedState.search;
            syncClear();
            rightControls.appendChild(searchField);
            filterBar.appendChild(rightControls);

            mountFilterBar(filterBar, documentView);

            // "Load more" pagination — one button per table, right after it,
            // shown only once that table has more *matching* content than is
            // currently revealed. A normal table reveals PAGE_SIZE rows at a
            // time (which never engages on a page of many small per-section
            // tables). A "sorted" table — one long, dated list — reveals
            // whole months instead (MONTH_PAGE_SIZE at a time), so a month's
            // entries are never split across a "Load more".
            const PAGE_SIZE = 10;
            const MONTH_PAGE_SIZE = 5;
            const isByMonth = (table: HTMLTableElement) => Boolean(table.dataset.releaseNotesSorted);
            const pageSizeOf = (table: HTMLTableElement) => (isByMonth(table) ? MONTH_PAGE_SIZE : PAGE_SIZE);
            const visibleCounts = new Map<HTMLTableElement, number>();
            const loadMoreButtons = new Map<HTMLTableElement, HTMLButtonElement>();
            releaseNotesTables.forEach((table) => {
                visibleCounts.set(table, pageSizeOf(table));
                const button = document.createElement('button');
                button.type = 'button';
                button.classList.add('release-notes-loadmore');
                button.textContent = 'Load more';
                button.style.display = 'none';
                button.addEventListener('click', () => {
                    visibleCounts.set(table, (visibleCounts.get(table) ?? pageSizeOf(table)) + pageSizeOf(table));
                    applyFilters(false);
                });
                table.insertAdjacentElement('afterend', button);
                loadMoreButtons.set(table, button);
            });

            // Shown in place of the tables when the search and filters match
            // no row (same wording as the Action reference page's filter).
            const emptyState = document.createElement('div');
            emptyState.classList.add('release-notes-empty-state');
            emptyState.setAttribute('role', 'status');
            emptyState.style.display = 'none';
            emptyState.innerHTML = '<h4>No results for your search</h4><p>You can change your search and try again.</p>';
            const lastTable = releaseNotesTables[releaseNotesTables.length - 1];
            const lastAnchor = lastTable ? loadMoreButtons.get(lastTable) ?? lastTable : null;
            lastAnchor?.insertAdjacentElement('afterend', emptyState);

            // A filter/search change should jump back to the first page of
            // results rather than stay scrolled deep into whatever was
            // expanded before — only "Load more" itself (resetPagination:
            // false) should grow a table's visible count.
            const applyFilters = (resetPagination = true) => {
                const breakingOnly = breakingCheckbox?.checked ?? false;
                const searchQuery = searchInput.value.trim().toLowerCase();
                if (resetPagination) releaseNotesTables.forEach((table) => visibleCounts.set(table, pageSizeOf(table)));

                let totalMatching = 0;
                releaseNotesTables.forEach((table) => {
                    const colIndexByLabel = columnIndexByTable.get(table);
                    const rows = bodyRows(table);

                    const matchingRows = rows.filter((row) => {
                        const matchesDimensions = Array.from(selectsByLabel.entries()).every(([label, dimension]) => {
                            const selectedValues = dimension.getValues();
                            if (selectedValues.length === 0) return true; // "All" / nothing checked
                            // A dimension derived from the row itself (Month)
                            // rather than from a column.
                            if (dimension.rowValues) {
                                const derived = dimension.rowValues(row);
                                return selectedValues.some((v) => derived.includes(v));
                            }
                            const colIndex = colIndexByLabel?.get(label);
                            if (!colIndex) return true; // table doesn't author this column — not excluded by it
                            // A cell can carry more than one value (Topic);
                            // a row matches if it has ANY selected value —
                            // multiple checked boxes within one dimension
                            // OR together, same as a real multi-select would.
                            const rowValues = splitCell(cellText(row, colIndex));
                            return selectedValues.some((v) => rowValues.includes(v));
                        });
                        const matchesSearch = !searchQuery || (row.textContent?.toLowerCase().includes(searchQuery) ?? false);
                        return matchesDimensions && matchesSearch;
                    });

                    const limit = visibleCounts.get(table) ?? pageSizeOf(table);
                    let visibleRows: Set<HTMLElement>;
                    let hasMore: boolean;
                    if (isByMonth(table)) {
                        const months = Array.from(new Set(matchingRows.map((row) => row.dataset.month ?? '')));
                        const shownMonths = new Set(months.slice(0, limit));
                        visibleRows = new Set(matchingRows.filter((row) => shownMonths.has(row.dataset.month ?? '')));
                        hasMore = months.length > limit;
                    } else {
                        visibleRows = new Set(matchingRows.slice(0, limit));
                        hasMore = matchingRows.length > limit;
                    }
                    rows.forEach((row) => {
                        row.style.display = visibleRows.has(row) ? '' : 'none';
                    });

                    const loadMoreButton = loadMoreButtons.get(table);
                    if (loadMoreButton) loadMoreButton.style.display = hasMore ? '' : 'none';

                    totalMatching += matchingRows.length;
                    const sect2 = table.closest<HTMLElement>('.sect2');
                    if (sect2) sect2.dataset.hasVisibleRows = matchingRows.length > 0 ? 'true' : 'false';

                    if (table.classList.contains('release-notes-no-header')) dedupeDateColumn(table);
                });

                const nothingMatches = releaseNotesTables.length > 0 && totalMatching === 0;
                emptyState.style.display = nothingMatches ? '' : 'none';
                releaseNotesTables.forEach((table) => {
                    table.style.display = nothingMatches ? 'none' : '';
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

            changeTargets.forEach((target) => target.addEventListener('change', () => applyFilters(true)));
            breakingCheckbox?.addEventListener('change', () => applyFilters(true));

            let searchDebounce: ReturnType<typeof setTimeout>;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => {
                    writeFilterState(documentView, { ...readFilterState(documentView, tabsEl), search: searchInput.value });
                    applyFilters(true);
                }, 200);
            });

            applyFilters(true);

            // Deep links to a release or an entry (`page#rest-api-26-10-0-cl`).
            // The target row may be hidden — beyond what "Load more" has
            // revealed, or outside the active tab — so a plain anchor jump
            // wouldn't land anywhere. Switch back to "All" if the row isn't
            // in the active tab, reveal enough rows/months to include it,
            // then scroll it to just below the pinned header.
            const revealHashTarget = () => {
                const id = decodeURIComponent(window.location.hash.slice(1));
                if (!id || id.startsWith('tab-')) return;
                const target = document.getElementById(id);
                // The target can sit inside a table nested in a description —
                // walk up to the release row it belongs to.
                let row = target?.closest<HTMLElement>('tr') ?? null;
                while (row && !releaseNotesTables.includes(row.closest<HTMLTableElement>('table') as HTMLTableElement)) {
                    row = row.parentElement?.closest<HTMLElement>('tr') ?? null;
                }
                const table = row?.closest<HTMLTableElement>('table');
                if (!target || !row || !table || !releaseNotesTables.includes(table)) return;

                if (!inScope(table, row)) {
                    if (tabsEl) selectTopics(documentView, tabsEl, [], { keepHash: true });
                    return;
                }

                const scoped = bodyRows(table).filter((r) => inScope(table, r));
                const needed = isByMonth(table)
                    ? Array.from(new Set(scoped.map((r) => r.dataset.month ?? ''))).indexOf(row.dataset.month ?? '') + 1
                    : scoped.indexOf(row) + 1;
                if (needed > (visibleCounts.get(table) ?? 0)) {
                    visibleCounts.set(table, needed);
                    applyFilters(false);
                }

                requestAnimationFrame(() => {
                    const scroller = target.closest<HTMLElement>('.documentWrapperContainer');
                    const stackBottom =
                        (parseFloat(documentView.style.getPropertyValue('--release-notes-pinned-stack-height')) || 0) +
                        (scroller?.getBoundingClientRect().top ?? 0);
                    const delta = target.getBoundingClientRect().top - (stackBottom + 12);
                    if (scroller) scroller.scrollTop += delta;
                    else window.scrollBy(0, delta);
                });
            };

            const onHashChange = () => {
                const { hash } = window.location;
                const tabLink = tabsEl
                    ? tabLinks(tabsEl).find((a) => hash.startsWith('#tab-') && a.hash === hash)
                    : undefined;
                if (tabsEl && tabLink) {
                    if (tabTopic(tabLink) !== activeTopic) selectTopics(documentView, tabsEl, tabTopic(tabLink) ? [tabTopic(tabLink)] : [], { keepHash: true, fresh: true });
                    return;
                }
                revealHashTarget();
            };
            window.addEventListener('hashchange', onHashChange);
            const previousTeardown = teardownNavTabListeners;
            teardownNavTabListeners = () => {
                previousTeardown?.();
                window.removeEventListener('hashchange', onHashChange);
            };

            revealHashTarget();
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
