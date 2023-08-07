require('dotenv').config();
const asciidoc = require('asciidoctor')();
const config = require('./src/configs/doc-configs');

const getPathPrefix = () => {
    // if (process.env.BUILD_ENV === config.BUILD_ENVS.LOCAL) {
    //     return null;
    // }
    // return null;
    return 'docs';
};

const getPath = (path) =>
    getPathPrefix() ? `${path}/${getPathPrefix()}` : path;

class CustomDocConverter {
    constructor() {
        this.baseConverter = asciidoc.Html5Converter.$new();
    }

    /**
     * Check if inline_anchor target is for transformation or not
     * @param {string} target - inline_anchor target i.e. href
     * @returns {boolean} true if transformation is needed else false
     */
    isTransformLink(target) {
        return (
            !target.includes(`{{${config.NAV_PREFIX}}}`) &&
            !target.includes(`{{${config.PREVIEW_PREFIX}}}`) &&
            !target.includes(`{{${config.TS_HOST_PARAM}}}`) &&
            !target.includes('www.') &&
            !target.startsWith('http')
        );
    }

    /**
     * Convert is used to return html node string based on transform or conditions
     * @param {any} node - The concrete instance of AbstractNode to convert.
     * @param {string} transform - An optional string transform that hints at which transformation should be applied to this node.
     * @returns {string} html node string
     */
    convert(node, transform) {
        // checking anchor node type
        if (node.getNodeName() === 'inline_anchor') {
            let anchorMarkup = '';

            // get anchor target set inside adoc file
            let target = node.getTarget();

            // get anchor attributes
            const attributes = node.getAttributes();
            if (this.isTransformLink(target)) {
                // check if link is for 'Visual Embed SDK' documents or not
                if (target.includes(config.VISUAL_EMBED_SDK_PREFIX)) {
                    anchorMarkup = `${getPath(config.DOC_REPO_NAME)}/${
                        config.TYPE_DOC_PREFIX
                    }${target.replace(
                        `{{${config.VISUAL_EMBED_SDK_PREFIX}}}`,
                        '',
                    )}`;
                } else if (!target.startsWith('#')) {
                    target = target.substring(
                        target.lastIndexOf(':') + 1,
                        target.lastIndexOf('.html'),
                    );

                    anchorMarkup = `{{${config.NAV_PREFIX}}}/{{${target}}}`;
                }

                // attribute handling - DO NOT CHANGE ORDER OF IFs
                if (attributes.fragment) {
                    anchorMarkup += `#${attributes.fragment}`;
                }
                anchorMarkup = `href="${anchorMarkup}"`;
                if (attributes.window) {
                    anchorMarkup += ` target="${attributes.window}"`;
                }
                return `<a ${anchorMarkup}>${node.getText()}</a>`;
            }
        }
        // console.log(node);
        return this.baseConverter.convert(node, transform);
    }
}

console.log(getPath(config.DOC_REPO_NAME));
module.exports = {
    pathPrefix: getPath(config.DOC_REPO_NAME),
    siteMetadata: {
        title: 'tseverywhere-docs',
        url: 'https://developer-docs-zeta.vercel.app',
        image: './images/favicon.svg',
    },
    plugins: [
        'gatsby-plugin-sass',
        {
            resolve: 'gatsby-plugin-page-creator',
            options: {
                path: `${__dirname}/src/page`,
            },
        },
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'pages',
                path: `${__dirname}/src/page/`,
            },
            __key: 'pages',
        },
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'pages',
                path: `${__dirname}/modules/ROOT/pages`,
            },
            __key: 'pages',
        },
        {
            resolve: 'gatsby-source-filesystem',
            options: {
                name: 'common',
                path: `${__dirname}/modules/ROOT/pages/common/`,
            },
            __key: 'pages_common',
        },
        {
            resolve: 'gatsby-plugin-intl',
            options: {
                // language JSON resource path
                path: `${__dirname}/src/intl`,
                // supported language
                languages: ['en'],
                // language file path
                defaultLanguage: 'en',
                // option to redirect to `/en` when connecting `/`
                redirect: false,
            },
        },
        {
            resolve: 'gatsby-transformer-asciidoc',
            options: {
                safe: 'server',
                attributes: {
                    showtitle: true,
                    imagesdir: '/doc-images',
                    path: `${__dirname}/modules/ROOT/pages/partials`,
                },
                fileExtensions: ['ad', 'adoc'],
                converterFactory: CustomDocConverter,
            },
        },
        // {
        //     resolve: 'gatsby-transformer-rehype',
        //     options: {
        //         mediaType: 'text/html',
        //     },
        // },
        {
            resolve: 'gatsby-source-git',
            options: {
                name: 'htmlFiles',
                remote: 'https://github.com/thoughtspot/visual-embed-sdk.git',
                branch: 'main',
                patterns: 'static/typedoc/**',
            },
            __key: 'htmlFiles',
        },
        'gatsby-plugin-catch-links',
        {
            resolve: 'gatsby-plugin-manifest',
            options: {
                name: 'ThoughtSpot Everywhere Documentation',
                short_name: 'Documentation',
                icon: `${__dirname}/src/assets/icons/favicon.png`,
            },
        },
        'gatsby-plugin-output',
        {
            resolve: 'gatsby-plugin-algolia',
            options: {
                appId: process.env.GATSBY_ALGOLIA_APP_ID,
                apiKey: process.env.ALGOLIA_ADMIN_KEY,
                queries: require(`${__dirname}/src/utils/algolia-queries`)
                    .queries,
            },
        },
        {
            resolve: 'gatsby-plugin-sitemap',
            options: {
                query: `
                {
                    allAsciidoc {
                        edges {
                            node {
                                pageAttributes {
                                    pageid
                                }
                            }
                        }
                    }
                }`,
                resolveSiteUrl: () => config.SITE_URL,
                resolvePages: ({ allAsciidoc: { edges } }) => {
                    const asciiNodeSet = new Set();
                    edges.forEach((edge) => {
                        if (
                            edge.node &&
                            edge.node.pageAttributes &&
                            edge.node.pageAttributes.pageid
                        ) {
                            asciiNodeSet.add(edge.node.pageAttributes.pageid);
                        }
                    });
                    const paths = [];
                    for (const item of asciiNodeSet) {
                        paths.push({ path: `/${item}` });
                    }
                    return paths;
                },
                serialize: ({ path }) => {
                    return {
                        url: path,
                    };
                },
            },
        },
        {
            resolve: 'gatsby-plugin-env-variables',
            options: {
                allowList: ['BUILD_ENV'],
            },
        },
        {
            resolve: 'gatsby-plugin-vercel',
            options: {
                // (optional) Prints metrics in the console when true
                debug: false,
            },
        },
    ],
};
