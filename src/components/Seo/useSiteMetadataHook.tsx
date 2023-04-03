// eslint-disable-next-line import/no-extraneous-dependencies
import { graphql, useStaticQuery } from 'gatsby';

export const useSiteMetadata = () => {
    const data = useStaticQuery(graphql`
        query {
            site {
                siteMetadata {
                    title
                    description
                    url
                    image
                }
            }
        }
    `);

    return data.site.siteMetadata;
};
