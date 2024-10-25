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
        const { sourceInstanceName: sourceName, relativePath : relPath } = e.node.parent;
        const pageId = e.node.pageAttributes.pageid;
        if (sourceName === 'tutorials'){
           const relPathSplit = relPath.split('/');
           const pageIdSplit = pageId.split('_');
           let finalPageId = pageId;
           if( pageIdSplit.length > 1) {
                finalPageId = pageIdSplit[1];
           }

           if(relPathSplit.length > 1) {
                const mapPageId = `tutorials/${relPathSplit[0]}/` + finalPageId;
                namePageIdMap[e.node.parent.name] =
                   mapPageId || NOT_FOUND_PAGE_ID;
           }
        }

        else {
            namePageIdMap[e.node.parent.name] =
                e.node.pageAttributes.pageid || NOT_FOUND_PAGE_ID;
        }
    });

    data.allAsciidoc.edges.forEach((edge) => {
        const { pageid: pageId } = edge.node.pageAttributes;
        const { sourceInstanceName: sourceName, relativePath : relPath } = edge.node.parent;

        // Tutorials module pageids follow pattern {subdirectory}_{final_url_stub} to give unique IDs in system but allow directory structure in URL
        if (sourceName === 'tutorials'){            
           // One-level of subdirectory part of stub
           const relPathSplit = relPath.split('/');
           const pageIdSplit = pageId.split('_');
           let finalPageId = pageId;
           if( pageIdSplit.length > 1) {
                finalPageId = pageIdSplit[1];
           }

           const finalPath = `/tutorials/${relPathSplit[0]}/${finalPageId}`;

           if(relPathSplit.length > 1) {
               actions.createPage({
                        path: finalPath,
                        component: require.resolve(
                            './src/components/DevDocTemplate/index.tsx',
                        ),
                        context: { pageId, navId: DOC_NAV_PAGE_ID, namePageIdMap },
                    });
           }
        }

        else {
            actions.createPage({
                path: `/${pageId}`,
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
