const fsExtra = require('fs-extra');
const {
    DOC_NAV_PAGE_ID,
    NOT_FOUND_PAGE_ID,
    VERSION_DROPDOWN,
    SITE_URL,
    LLMS_SECTIONS,
} = require('./src/configs/doc-configs');
const { getDocLinkFromEdge } = require('./src/utils/gatsby-utils.js');

/* ── Build-time Markdown generation ───────────────────────────────────────
 * For every asciidoc node, convert the already-generated HTML to clean
 * Markdown using cheerio (DOM pre-processing) + turndown (HTML→MD).
 * The result is stored as `fields.markdownBody` on each node and exposed
 * in GraphQL so CopyPageDropdown can use it instead of scraping the DOM.
 */
exports.onCreateNode = ({ node, actions }) => {
    if (node.internal.type !== 'Asciidoc') return;

    const { createNodeField } = actions;
    const TurndownService = require('turndown');
    const cheerio = require('cheerio');

    const html = node.html || '';
    const title = node.document?.title || node.pageAttributes?.title || '';

    /* Load HTML into cheerio for pre-processing */
    const $ = cheerio.load(html, { decodeEntities: false });

    /* Remove anchor icon links that Asciidoctor injects next to headings */
    $('a.anchor').remove();

    /* Remove the embedded TOC — it adds noise to Markdown */
    $('#toc').remove();

    /* Convert admonition tables to readable text blocks */
    $('.admonitionblock').each((_, el) => {
        const type = $(el).attr('class').match(/\b(note|tip|warning|caution|important)\b/i)?.[1]?.toUpperCase() || 'NOTE';
        const content = $(el).find('td.content').text().trim();
        $(el).replaceWith(`<blockquote><p><strong>${type}:</strong> ${content}</p></blockquote>`);
    });

    /* Get the cleaned HTML */
    const cleanedHtml = $('body').html() || '';

    /* Configure turndown */
    const td = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
    });

    /* GFM table plugin — renders tables as proper Markdown pipe tables */
    const { tables } = require('turndown-plugin-gfm');
    td.use(tables);

    const markdownBody = td.turndown(cleanedHtml);

    createNodeField({
        node,
        name: 'markdownBody',
        value: markdownBody,
    });
};

exports.onPostBuild = async ({ graphql, reporter }) => {
    fsExtra.copyFileSync(
        `${__dirname}/robots.txt`,
        `${__dirname}/public/robots.txt`,
    );

    // Copy Radiant icon sprite to the root public folder so it's served at
    // /node_modules/... — the hardcoded path Radiant fetches regardless of pathPrefix
    const spriteSrc = `${__dirname}/node_modules/@thoughtspot/radiant-react/styles/img/rd-icons/rd-icons-sprite/rd-icons.svg`;
    const spriteDest = `${__dirname}/public/node_modules/@thoughtspot/radiant-styles/public/img/rd-icons/rd-icons-sprite/rd-icons.svg`;
    fsExtra.ensureDirSync(require('path').dirname(spriteDest));
    fsExtra.copyFileSync(spriteSrc, spriteDest);

    try {
        const result = await graphql(`
            query {
                allAsciidoc {
                    edges {
                        node {
                            document { title }
                            pageAttributes { pageid }
                        }
                    }
                }
            }
        `);

        if (result.errors) {
            reporter.warn(`llms.txt generation: GraphQL errors — ${JSON.stringify(result.errors)}`);
            return;
        }

        const pageMap = {};
        result.data.allAsciidoc.edges.forEach(({ node }) => {
            const pageid = node.pageAttributes?.pageid;
            const title = node.document?.title;
            if (pageid && title) pageMap[pageid] = title;
        });

        const lines = [
            '# ThoughtSpot Developer Documentation',
            '',
            '> Developer documentation for ThoughtSpot Embedded — tools, APIs, and SDKs for embedding ThoughtSpot analytics into your applications.',
            '',
        ];

        for (const section of LLMS_SECTIONS) {
            lines.push(`## ${section.label}`);
            for (const pageId of section.pageIds) {
                const title = pageMap[pageId];
                if (title) lines.push(`- [${title}](${SITE_URL}/${pageId})`);
            }
            lines.push('');
        }

        fsExtra.writeFileSync(
            `${__dirname}/public/llms.txt`,
            lines.join('\n'),
        );
        reporter.info(`llms.txt generated with ${Object.keys(pageMap).length} pages`);
    } catch (err) {
        reporter.warn(`llms.txt generation failed: ${err.message}`);
    }
};
exports.createPages = async function ({ actions, graphql }) {
    const { data } = await graphql(`
        query {
            allAsciidoc {
                edges {
                    node {
                        html
                        document {
                            title
                        }
                        pageAttributes {
                            pageid
                        }
                        parent {
                            ... on File {
                                name
                                sourceInstanceName
                                relativePath
                            }
                        }
                    }
                }
            }
        }
    `);

    const namePageIdMap = {};
    // Collect per-category nav HTMLs keyed by category name (pageid minus 'nav-' prefix)
    const navMap = {};
    const NAV_PARTIAL_PREFIX = 'nav-';

    data.allAsciidoc.edges.forEach((e) => {
        const {
            sourceInstanceName: sourceName,
            relativePath: relPath,
        } = e.node.parent;
        const pageId = e.node.pageAttributes.pageid;

        // Collect nav-* files into the navMap (not content pages)
        if (pageId && pageId.startsWith(NAV_PARTIAL_PREFIX)) {
            navMap[pageId.slice(NAV_PARTIAL_PREFIX.length)] = e.node.html;
            return;
        }

        if (sourceName === 'tutorials') {
            const relPathSplit = relPath.split('/');
            const pageIdSplit = pageId.split('__');
            let finalPageId = pageId;
            if (pageIdSplit.length > 1) {
                finalPageId = pageIdSplit[1];
            }
            let mapPageId = `tutorials/${finalPageId}`;
            if (relPathSplit.length > 1) {
                mapPageId = `tutorials/${relPathSplit[0]}/${finalPageId}`;
            }
            namePageIdMap[e.node.parent.name] = mapPageId || NOT_FOUND_PAGE_ID;
        } else {
            namePageIdMap[e.node.parent.name] =
                e.node.pageAttributes.pageid || NOT_FOUND_PAGE_ID;
        }
    });

    data.allAsciidoc.edges.forEach((edge) => {
        const { pageid: pageId } = edge.node.pageAttributes;

        // Skip nav partial files — they are sidebar data, not content pages
        if (pageId && pageId.startsWith(NAV_PARTIAL_PREFIX)) return;

        const docPath = getDocLinkFromEdge(edge);
        actions.createPage({
            path: docPath,
            component: require.resolve(
                './src/components/DevDocTemplate/index.tsx',
            ),
            context: { pageId, navId: DOC_NAV_PAGE_ID, navMap, namePageIdMap },
        });

        if (pageId === 'introduction') {
            actions.createPage({
                path: '/',
                component: require.resolve(
                    './src/components/DevDocTemplate/index.tsx',
                ),
                context: { pageId, navId: DOC_NAV_PAGE_ID, navMap, namePageIdMap },
            });
        }
    });

    VERSION_DROPDOWN.forEach((version) => {
        if (version.link === ' ' || !version.iframeUrl) {
            return;
        }

        const versionPath = version.link.startsWith('/')
            ? version.link.substring(1)
            : version.link;

        actions.createPage({
            path: `/${versionPath}`,
            component: require.resolve(
                './src/components/DevDocTemplate/index.tsx',
            ),
            context: { iframeUrl: version.iframeUrl },
        });
    });
};
