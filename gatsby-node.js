const fsExtra = require('fs-extra');
const {
    DOC_NAV_PAGE_ID,
    NOT_FOUND_PAGE_ID,
    VERSION_DROPDOWN,
} = require('./src/configs/doc-configs');
const { getDocLinkFromEdge } = require('./src/utils/gatsby-utils.js');

exports.onPostBuild = () => {
    fsExtra.copyFileSync(
        `${__dirname}/robots.txt`,
        `${__dirname}/public/robots.txt`,
    );
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
    data.allAsciidoc.edges.forEach((e) => {
        const {
            sourceInstanceName: sourceName,
            relativePath: relPath,
        } = e.node.parent;
        const pageId = e.node.pageAttributes.pageid;
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

        const docPath = getDocLinkFromEdge(edge);
        actions.createPage({
            path: docPath,
            component: require.resolve(
                './src/components/DevDocTemplate/index.tsx',
            ),
            context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
        });

        if (pageId === 'introduction') {
            actions.createPage({
                path: '/',
                component: require.resolve(
                    './src/components/DevDocTemplate/index.tsx',
                ),
                context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
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
