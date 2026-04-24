import React from 'react';
import { navigate } from 'gatsby';
import './index.scss';

export type DocCategory =
    | 'all'
    | 'embedding'
    | 'mcp-server'
    | 'spottercode'
    | 'apis-sdk'
    | 'whats-new';

export const CATEGORY_LABELS: Record<DocCategory, string> = {
    all: 'All docs',
    embedding: 'Embedding',
    'mcp-server': 'MCP server',
    spottercode: 'SpotterCode',
    'apis-sdk': 'APIs & SDK',
    'whats-new': "What's new",
};

/*
 * Landing page for each category — the first page shown when a tab is clicked.
 * These are the pageid values from the AsciiDoc source.
 */
export const CATEGORY_LANDING: Record<DocCategory, string> = {
    all: '/introduction',
    embedding: '/introduction',
    'mcp-server': '/mcp-ts-server',
    spottercode: '/spottercode',
    'apis-sdk': '/rest-api-v2',
    'whats-new': '/whats-new',
};

/*
 * Page IDs that belong to each category.
 * Used to auto-highlight the active tab when navigating directly to a page.
 *
 * Sidebar filtering note:
 * The nav.adoc is a superset of all pages. To filter the sidebar per category,
 * the nav.adoc would need to be split into per-category nav files (e.g. nav-embedding.adoc,
 * nav-mcp.adoc) and the DevDocTemplate would pass the appropriate navId based on
 * the active category. Until then, the sidebar shows all content and the secondary
 * header acts as a jump-to-category navigation.
 */
export const CATEGORY_PAGEIDS: Record<DocCategory, string[]> = {
    all: [],
    embedding: [
        'introduction', 'embed-sdk', 'full-embed', 'search-embed', 'liveboard-embed',
        'viz-embed', 'app-embed', 'natural-language-search-embed', 'embed-events',
        'custom-actions', 'authentication', 'trusted-auth', 'saml-sso', 'oidc',
        'security-settings', 'custom-styles', 'runtime-filters', 'runtime-sort',
        'runtime-parameters', 'embed-nav', 'page-load-optimization', 'react-components',
        'web-components', 'pinboard-embed', 'faqs', 'migration',
    ],
    'mcp-server': ['mcp-server', 'mcp-ts-server', 'mcp-intro'],
    spottercode: ['spottercode', 'spotter-overview', 'spotter-code', 'spotter-apis'],
    'apis-sdk': [
        'rest-api-v2', 'restV2-playground', 'graphql-play-ground', 'typedoc',
        'sdk-overview', 'rest-api-v1',
    ],
    'whats-new': ['whats-new', 'changelog', 'release-notes', 'deprecations'],
};

const SecondaryHeader = (props: {
    activeCategory: DocCategory;
    onCategoryChange: (category: DocCategory) => void;
}) => {
    const { activeCategory, onCategoryChange } = props;

    const categories: DocCategory[] = [
        'embedding', 'mcp-server', 'spottercode', 'apis-sdk', 'whats-new',
    ];

    const handleClick = (cat: DocCategory) => {
        onCategoryChange(cat);
        const landing = CATEGORY_LANDING[cat];
        if (landing) {
            navigate(landing);
        }
    };

    return (
        <nav className="secondary-header" aria-label="Documentation categories">
            <div className="secondary-header__inner">
                <ul className="secondary-header__tabs" role="tablist">
                    {categories.map((cat) => (
                        <li key={cat} role="none">
                            <button
                                role="tab"
                                aria-selected={activeCategory === cat}
                                className={`secondary-header__tab ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => handleClick(cat)}
                            >
                                {CATEGORY_LABELS[cat]}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

export default SecondaryHeader;
