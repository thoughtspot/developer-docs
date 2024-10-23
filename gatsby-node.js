const fsExtra = require('fs-extra');
const {
    DOC_NAV_PAGE_ID,
    NOT_FOUND_PAGE_ID,
} = require('./src/configs/doc-configs');

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
                                dir
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
        namePageIdMap[e.node.parent.name] =
            e.node.pageAttributes.pageid || NOT_FOUND_PAGE_ID;
    });

    data.allAsciidoc.edges.forEach((edge) => {
        const { pageid: pageId } = edge.node.pageAttributes;
        const { sourceInstanceName: sourceName, dir : directory, relativePath : relPath } = edge.node.parent;

        actions.createPage({
            path: `/${pageId}`,
            component: require.resolve(
                './src/components/DevDocTemplate/index.tsx',
            ),
            context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
        });

        if (sourceName === 'tutorials'){
                actions.createPage({
                path: `/tutorials/${pageId}`,
                component: require.resolve(
                    './src/components/DevDocTemplate/index.tsx',
                ),
                context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
            });
            
           // Directory experiment
            /*
           const dirSplit = directory.split('/');
           const lastDir = dirSplit[dirSplit.length - 2];
           */
           actions.createPage({
                    path: `/tutorials/$(relPath}`,
                    component: require.resolve(
                        './src/components/DevDocTemplate/index.tsx',
                    ),
                    context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
                });
            
            
        }

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
};
