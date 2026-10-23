/*
 * The filter on the Action reference page (EmbedTypeFilter) hides the actions that do not
 * match, and tells the right-hand "on this page" list (Docmap) which entries to hide with
 * them. The two are separate components, so the filter does not touch Docmap's DOM: it
 * sends the ids of the hidden sections, and Docmap hides the entries itself from its state.
 * That way the entries stay hidden if Docmap rebuilds its list.
 */
export const DOC_FILTER_EVENT = 'doc-filter-hidden-ids';

export const dispatchHiddenIds = (hiddenIds: string[]) => {
    window.dispatchEvent(
        new CustomEvent(DOC_FILTER_EVENT, { detail: { hiddenIds } }),
    );
};
