import React, { useEffect, useRef, useState } from 'react';
import { MdClear } from '@react-icons/all-files/md/MdClear';
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

// The name on the filter chip: "Action" with the filter icon, and "Action Select" while the
// panel is open.
const COMPONENT_NAME = 'Action';

/*
 * Filter for the generated Action reference page. The search box is on the left and the
 * filter chip ("Action Select") next to it, as in the product UI guidelines. The chip opens
 * a panel with its own search row and a list of checkboxes, one per embed type. A small
 * x on the chip clears the selection.
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
    // The search row inside the panel, which narrows the list of embed types.
    const [optionQuery, setOptionQuery] = useState('');
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

    const options = [...embedTypes, ...(uncategorized > 0 ? [OTHER] : [])];
    const visibleOptions = options.filter((option) =>
        option.toLowerCase().includes(optionQuery.trim().toLowerCase()),
    );

    // Close the panel on an outside click or Escape.
    useEffect(() => {
        if (!open) {
            setOptionQuery('');
            return undefined;
        }
        const onClick = (event: MouseEvent) => {
            // Use the path of the click, not event.target: opening the panel replaces the filter
            // icon on the chip with "Select", so the element that was clicked is no longer on the
            // page when this listener runs, and "contains" would call the click an outside one
            // and close the panel again straight away.
            const clickedInside = rootRef.current
                ? event.composedPath().includes(rootRef.current)
                : false;
            if (!clickedInside) setOpen(false);
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
                <div className="embed-type-filter__dropdown">
                    <button
                        type="button"
                        className="embed-type-filter__chip"
                        aria-haspopup="true"
                        aria-expanded={open}
                        aria-label="Filter actions by embed type"
                        onClick={() => setOpen((isOpen) => !isOpen)}
                    >
                        {COMPONENT_NAME}
                        {open ? (
                            <strong>Select</strong>
                        ) : (
                            <MdFilterList
                                className="embed-type-filter__chip-icon"
                                aria-hidden="true"
                            />
                        )}
                    </button>
                    {selected.length > 0 && (
                        <button
                            type="button"
                            className="embed-type-filter__chip-clear"
                            aria-label="Clear the embed type selection"
                            onClick={() => setSelected([])}
                        >
                            <MdClear aria-hidden="true" />
                        </button>
                    )}
                    {open && (
                        <div
                            className="embed-type-filter__menu"
                            role="group"
                            aria-label="Embed type"
                        >
                            <label className="embed-type-filter__menu-search">
                                <BiSearch aria-hidden="true" />
                                <input
                                    type="search"
                                    placeholder="Search"
                                    aria-label="Search embed types"
                                    value={optionQuery}
                                    onChange={(event) =>
                                        setOptionQuery(event.target.value)
                                    }
                                />
                            </label>
                            <div className="embed-type-filter__options">
                                {visibleOptions.map((embedType) => (
                                    <label
                                        key={embedType}
                                        className="embed-type-filter__option"
                                        title={
                                            embedType === OTHER
                                                ? 'Actions that are not categorized by embed type yet'
                                                : embedType
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
                                {!visibleOptions.length && (
                                    <div className="embed-type-filter__empty">
                                        No matches
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <span className="embed-type-filter__status" aria-live="polite">
                {statusText}
            </span>
        </div>
    );
};

export default EmbedTypeFilter;
