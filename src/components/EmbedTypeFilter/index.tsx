import React, { useEffect, useRef, useState } from 'react';
import { MdFilterList } from '@react-icons/all-files/md/MdFilterList';
import { BiSearch } from '@react-icons/all-files/bi/BiSearch';
import { dispatchHiddenIds } from '../../utils/doc-filter-events';
import './index.scss';

// "A", "A and B", "A, B, and C"
const joinWithAnd = (items: string[]) => {
    if (items.length <= 2) return items.join(' and ');
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

// The option for the actions that are not categorized by embed type yet.
const OTHER = 'Other';

/*
 * Filter for the generated Action reference page, using the same pattern as
 * the release-notes filter bar: a "Filter" button that opens a panel of
 * multi-select checkboxes, plus a search box.
 *
 * The converter (scripts/Converter/index.ts) writes a "Supported in" paragraph
 * with the class `supported-in` under each action, and a placeholder for this
 * component with the embed types as a comma separated `data-embed-types`
 * attribute. An action shows when its "Supported in" line lists at least one
 * checked embed type (OR) and, if there is a search term, its text contains it
 * (AND). An action with no "Supported in" line is not categorized by embed type
 * yet. It shows under "All", in a search, and when "Other" is checked, which is
 * only offered while such actions exist.
 *
 * Hidden actions are also removed from the Index of the page. The right-hand "on this
 * page" list (Docmap) is told which sections are hidden (see utils/doc-filter-events)
 * and hides those entries itself.
 */
const EmbedTypeFilter = (props: { embedTypes: string[] }) => {
    const { embedTypes } = props;
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    // How many actions have no embed type yet; "Other" is only offered while there are some.
    const [uncategorized, setUncategorized] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);

    const toggle = (embedType: string) => {
        setSelected((current) =>
            current.includes(embedType)
                ? current.filter((value) => value !== embedType)
                : [...current, embedType],
        );
    };

    // What is being shown, in the order of the panel: "for SpotterEmbed", "for SpotterEmbed
    // and ungrouped Action IDs", or just "ungrouped Action IDs" when only Other is checked.
    const checkedEmbedTypes = embedTypes.filter((embedType) =>
        selected.includes(embedType),
    );
    const checkedOther = selected.includes(OTHER);
    let statusText = '';
    if (checkedEmbedTypes.length) {
        statusText = `Showing Action IDs for ${joinWithAnd([
            ...checkedEmbedTypes,
            ...(checkedOther ? ['ungrouped Action IDs'] : []),
        ])}.`;
    } else if (checkedOther) {
        statusText = 'Showing ungrouped Action IDs.';
    }

    // Close the panel on an outside click or Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    useEffect(() => {
        const view = rootRef.current?.closest('.documentView');
        if (!view) return undefined;

        const hiddenEntries: HTMLElement[] = [];
        const hide = (el: HTMLElement | null) => {
            if (!el) return;
            el.style.display = 'none';
            hiddenEntries.push(el);
        };

        const search = query.trim().toLowerCase();
        let uncategorizedCount = 0;
        const hiddenIds: string[] = [];
        const actionSections = Array.from(
            view.querySelectorAll<HTMLElement>('.sect2'),
        );
        actionSections.forEach((section) => {
            const supportedIn = Array.from(
                section.querySelectorAll('.supported-in a'),
            ).map((link) => link.textContent?.trim() || '');
            if (!supportedIn.length) uncategorizedCount += 1;
            const matchesEmbedType =
                !selected.length ||
                selected.some((option) =>
                    option === OTHER
                        ? !supportedIn.length
                        : supportedIn.includes(option),
                );
            const matchesSearch =
                !search || (section.textContent || '').toLowerCase().includes(search);
            if (matchesEmbedType && matchesSearch) return;
            hide(section);
            const id = section.querySelector('h3')?.id;
            if (!id) return;
            hiddenIds.push(id);
            // The entry in the Index of this page. Its link ends in "#id" after the page
            // path. The query stays inside the page content: the right-hand "on this
            // page" list belongs to Docmap, which hides its own entries (see below).
            view.querySelectorAll(`a[href$="#${id}"]`).forEach((link) => {
                hide(link.closest<HTMLElement>('li'));
            });
        });
        setUncategorized(uncategorizedCount);
        dispatchHiddenIds(hiddenIds);

        return () => {
            hiddenEntries.forEach((el) => {
                // eslint-disable-next-line no-param-reassign
                el.style.display = '';
            });
        };
    }, [selected, query]);

    // Leaving the page: the right-hand list must not keep entries hidden.
    useEffect(() => () => dispatchHiddenIds([]), []);

    return (
        <div className="embed-type-filter" ref={rootRef}>
            <div className="embed-type-filter__controls">
                <div className="embed-type-filter__dropdown">
                    <button
                        type="button"
                        className={`embed-type-filter__trigger${
                            selected.length ? ' active' : ''
                        }`}
                        aria-haspopup="true"
                        aria-expanded={open}
                        aria-label="Filter by embed type"
                        onClick={() => setOpen((isOpen) => !isOpen)}
                    >
                        <span>Filter</span>
                        <MdFilterList className="embed-type-filter__icon" />
                    </button>
                    {open && (
                        <div className="embed-type-filter__menu">
                            {[
                                ...embedTypes,
                                ...(uncategorized > 0 ? [OTHER] : []),
                            ].map((embedType) => (
                                <label
                                    key={embedType}
                                    className="embed-type-filter__option"
                                    title={
                                        embedType === OTHER
                                            ? 'Actions that are not categorized by embed type yet'
                                            : undefined
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(embedType)}
                                        onChange={() => toggle(embedType)}
                                    />
                                    <span>{embedType}</span>
                                </label>
                            ))}
                            <button
                                type="button"
                                className="embed-type-filter__clear"
                                onClick={() => setSelected([])}
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
                <label className="embed-type-filter__search">
                    <BiSearch
                        className="embed-type-filter__search-icon"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        placeholder="Search"
                        aria-label="Search actions"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            <span className="embed-type-filter__status" aria-live="polite">
                {statusText}
            </span>
        </div>
    );
};

export default EmbedTypeFilter;
