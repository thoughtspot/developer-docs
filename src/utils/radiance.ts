import { useEffect } from 'react';

/**
 * Glue for the Radiance "home" product pattern used by the docs hero (home.adoc).
 *
 * The renderer (static/radiance/radiance-renderer.js) and the hero recipe
 * (src/assets/styles/radiance-home.css) are unmodified copies from the Radiance
 * language repo and must stay that way (RULES.md IMPL-1, PRODUCT-3). The only thing the
 * page owns is the theme: it sets data-radiance-appearance on the surface, and the
 * renderer repaints on change.
 */

const RENDERER_SRC = '/radiance/radiance-renderer.js';
const SURFACE_SELECTOR = '.radiance-local';

let rendererRequested = false;

// The renderer scans for .radiance-local elements on load and watches the DOM for new
// ones, so it is loaded once, and only when a page actually contains a surface.
const ensureRendererLoaded = () => {
    if (rendererRequested || typeof document === 'undefined') return;
    rendererRequested = true;
    const script = document.createElement('script');
    // __PATH_PREFIX__ is injected by Gatsby (e.g. '/docs' in production, '' locally).
    const prefix = typeof __PATH_PREFIX__ === 'string' ? __PATH_PREFIX__ : '';
    script.src = `${prefix}${RENDERER_SRC}`;
    script.async = true;
    document.body.appendChild(script);
};

const applyAppearance = (isDarkMode: boolean) => {
    const appearance = isDarkMode ? 'dark' : 'light';
    const surfaces = document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR);
    surfaces.forEach((surface) => {
        if (surface.dataset.radianceAppearance !== appearance) {
            surface.dataset.radianceAppearance = appearance;
        }
    });
    if (surfaces.length) ensureRendererLoaded();
};

/**
 * Keeps every Radiance surface on the page in the site's current theme. Page content is
 * injected after render, so new surfaces are picked up through a body observer too.
 */
export const useRadianceTheme = (isDarkMode: boolean) => {
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        applyAppearance(isDarkMode);
        if (!('MutationObserver' in window)) return undefined;
        const observer = new MutationObserver((mutations) => {
            const added = mutations.some((mutation) =>
                Array.from(mutation.addedNodes).some(
                    (node) =>
                        node instanceof Element &&
                        (node.matches(SURFACE_SELECTOR) || node.querySelector(SURFACE_SELECTOR)),
                ),
            );
            if (added) applyAppearance(isDarkMode);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [isDarkMode]);
};
