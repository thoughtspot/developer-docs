const fsExtra = require('fs-extra');

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
        const slug = edge.node.pageAttributes.pageid;
        actions.createPage({
            path: `/${slug}`,
            component: require.resolve('./src/components/TestPage/index.tsx'),
            context: { slug },
        });
    });
};
