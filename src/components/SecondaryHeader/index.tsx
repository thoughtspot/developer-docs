import React, { useState, useRef, useEffect } from 'react';
import { navigate } from 'gatsby';
import { GiHamburgerMenu } from '@react-icons/all-files/gi/GiHamburgerMenu';
import { AiOutlineCaretDown } from '@react-icons/all-files/ai/AiOutlineCaretDown';
import './index.scss';

export type DocCategory =
    | 'all'
    | 'guides'
    | 'embedding'
    | 'rest-api'
    | 'mcp-server'
    | 'spottercode'
    | 'whats-new';

export const CATEGORY_LABELS: Record<DocCategory, string> = {
    all: 'All docs',
    guides: 'Developer guides',
    embedding: 'Embedding',
    'rest-api': 'REST APIs',
    'mcp-server': 'MCP server',
    spottercode: 'SpotterCode',
    'whats-new': "What's new",
};

/*
 * Landing page for each category — the first page shown when a tab is clicked.
 */
export const CATEGORY_LANDING: Record<DocCategory, string> = {
    all: '/introduction',
    guides: '/introduction',
    embedding: '/getting-started',
    'rest-api': '/rest-apis',
    'mcp-server': '/mcp-integration',
    spottercode: '/SpotterCode',
    'whats-new': '/whats-new',
};

/*
 * Nav file pageid for each category — maps to the nav-*.adoc pageid queried at build time.
 * 'guides' uses the master nav.adoc (pageid: 'nav').
 */
export const CATEGORY_NAV_ID: Record<DocCategory, string> = {
    all: 'nav',
    guides: 'nav',
    embedding: 'nav-embedding',
    'rest-api': 'nav-rest-api',
    'mcp-server': 'nav-mcp-server',
    spottercode: 'nav-spottercode',
    'whats-new': 'nav',
};

/*
 * Page IDs that belong to each category.
 * Used to auto-highlight the active tab when navigating directly to a page.
 */
export const CATEGORY_PAGEIDS: Record<DocCategory, string[]> = {
    all: [],
    guides: [
        'introduction', 'ask-docs', 'development-and-deployment', 'thoughtspot-objects',
        'variables', 'parameterze-metdata', 'deploy-with-tml-apis', 'git-provider-integration',
        'modify-tml', 'publish-data-overview', 'parameterize-metadata', 'publish-to-orgs',
        'git-integration', 'git-configuration', 'git-api', 'guid-mapping',
        'multi-tenancy', 'orgs', 'multitenancy-within-an-org', 'single-tenant-data-models',
        'orgs-api-op', 'tse-cluster', 'external-tool-script-integration', 'pendo-integration',
        'sf-integration', 'vercel-integration', 'embed-ts', 'get-started-tse',
        'license-feature-matrix', 'faqs', 'code-samples',
    ],
    embedding: [
        'getting-started', 'tsembed', 'embed-liveboard', 'embed-a-viz',
        'embed-ai-search-analytics', 'embed-spotter', 'embed-spotter-agent',
        'full-embed', 'full-app-customize', 'customize-nav-controls', 'set-default-page',
        'customize-homepage-experience', 'search-embed', 'embed-searchbar', 'react-app-embed',
        'mobile-embed', 'embed-ts-mobile-react-native', 'embed-ts-flutter',
        'embed-ts-swift', 'embed-ts-android',
        'style-customization', 'customize-style', 'custom-css', 'css-variables-reference',
        'customize-icons', 'customize-text', 'theme-builder-doc',
        'filters-overview', 'runtime-overrides', 'runtime-filters', 'runtime-params',
        'action-config', 'actions', 'events-app-integration', 'embed-events', 'host-events',
        'context-aware-event-routing', 'hostEventsV2-migration', 'api-search-intercept',
        'custom-action-intro', 'customize-actions', 'custom-action-url', 'custom-action-callback',
        'custom-action-payload', 'edit-custom-action', 'add-action-viz', 'add-action-worksheet',
        'code-based-custom-action', 'customize-links', 'set-locale', 'custom-domain-config',
        'customize-emails', 'customize-email-apis', 'in-app-navigation',
        'security-settings', 'embed-auth', 'trusted-auth', 'trusted-auth-secret-key',
        'trusted-auth-sdk', 'trusted-auth-token-request-service', 'trusted-auth-troubleshoot',
        'saml-sso', 'oidc-auth', 'just-in-time-provisioning', 'embed-object-access',
        'access-control-sharing', 'privileges-and-roles', 'data-security', 'rls-rules',
        'abac-via-rls-variables', 'jwt-abac-migration-guide',
        'jwt-filter-parameters-rules-migration-guide', 'jwt-abac-beta-migration-guide',
        'abac-user-parameters', 'selective-user-access',
        'best-practices', 'prerender', 'lazy-load-fullHeight', 'prefetch',
        'troubleshoot-errors', 'embed-without-sdk', 'custom-viz-rest-api',
        'embed-sdk-changelog', 'mobile-sdk-changelog',
    ],
    'rest-api': [
        'rest-apis', 'api-user-management', 'rbac', 'spotter-api', 'audit-logs', 'tml',
        'collections', 'connections', 'connection-config',
        'rest-apiv2-getstarted', 'api-authv2', 'rest-apiv2-js', 'rest-apiv2-search',
        'rest-apiv2-users-search', 'rest-apiv2-groups-search', 'rest-apiv2-metadata-search',
        'fetch-data-and-report-apis', 'rest-api-sdk', 'rest-api-sdk-typescript', 'rest-api-sdk-java',
        'rest-api-getstarted', 'api-auth-session', 'catalog-and-audit', 'rest-api-pagination',
        'runtime-sort', 'v1v2-comparison', 'graphql-guide',
        'webhooks', 'webhooks-comm-channel', 'webhooks-s3-integration', 'webhooks-lb-schedule',
        'webhooks-lb-payload', 'webhooks-kpi', 'rest-v2-changelog', 'rest-v1-changelog',
    ],
    'mcp-server': [
        'mcp-integration', 'connect-mcp-server-to-clients',
        'custom-chatbot-integration-mcp', 'mcp-tool-reference', 'mcp-server-changelog',
    ],
    spottercode: [
        'SpotterCode', 'integrate-SpotterCode', 'spottercode-prompting-guide',
    ],
    'whats-new': [
        'whats-new', 'fixed-issues', 'known-issues', 'deprecated-features',
        'embed-sdk-changelog', 'mobile-sdk-changelog',
        'rest-v2-changelog', 'rest-v1-changelog', 'mcp-server-changelog',
    ],
};

const SecondaryHeader = (props: {
    activeCategory: DocCategory;
    onCategoryChange: (category: DocCategory) => void;
}) => {
    const { activeCategory, onCategoryChange } = props;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const categories: DocCategory[] = [
        'guides', 'embedding', 'rest-api', 'mcp-server', 'spottercode', 'whats-new',
    ];

    const handleClick = (cat: DocCategory) => {
        onCategoryChange(cat);
        setMobileMenuOpen(false);
        const landing = CATEGORY_LANDING[cat];
        if (landing) {
            navigate(landing);
        }
    };

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mobileMenuOpen]);

    return (
        <nav className="secondary-header" aria-label="Documentation categories">
            <div className="secondary-header__inner">
                {/* Desktop: full tab list */}
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

                {/* Mobile: hamburger trigger + dropdown */}
                <div className="secondary-header__mobile" ref={menuRef}>
                    <button
                        className="secondary-header__mobile-trigger"
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        aria-expanded={mobileMenuOpen}
                        aria-haspopup="listbox"
                    >
                        <GiHamburgerMenu className="secondary-header__mobile-icon" />
                        <span className="secondary-header__mobile-label">
                            {CATEGORY_LABELS[activeCategory]}
                        </span>
                        <AiOutlineCaretDown
                            className={`secondary-header__mobile-caret${mobileMenuOpen ? ' open' : ''}`}
                        />
                    </button>
                    {mobileMenuOpen && (
                        <div className="secondary-header__mobile-dropdown" role="listbox">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    role="option"
                                    aria-selected={activeCategory === cat}
                                    className={`secondary-header__mobile-item${activeCategory === cat ? ' active' : ''}`}
                                    onClick={() => handleClick(cat)}
                                >
                                    {CATEGORY_LABELS[cat]}
                                </button>
                            ))}
                            <button
                                className="secondary-header__mobile-item"
                                onClick={() => { navigate('/ask-docs'); setMobileMenuOpen(false); }}
                            >
                                AskDocs
                            </button>
                        </div>
                    )}
                </div>

                {/* Desktop only: AskDocs link */}
                <button
                    className="secondary-header__askdocs"
                    onClick={() => navigate('/ask-docs')}
                >
                    AskDocs <span className="secondary-header__beta">Beta</span>
                </button>
            </div>
        </nav>
    );
};

export default SecondaryHeader;
