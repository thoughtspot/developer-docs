declare module '*.svg' {
    const content: string;
    export default content;
}

// Injected by Gatsby at build time (the site's pathPrefix, e.g. '/docs').
declare const __PATH_PREFIX__: string;
