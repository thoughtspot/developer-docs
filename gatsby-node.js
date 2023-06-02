const fsExtra = require('fs-extra');
const { DOC_NAV_PAGE_ID } = require('./src/configs/doc-configs');

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
                    }
                }
            }
        }
    `);
    data.allAsciidoc.edges.forEach((edge) => {
        const { pageid: pageId } = edge.node.pageAttributes;
        actions.createPage({
            path: `/${pageId}`,
            component: require.resolve(
                './src/components/DevDocTemplate/index.tsx',
            ),
            context: { pageId, navId: DOC_NAV_PAGE_ID },
        });
    });
};
