import React, { FC } from 'react';
import { Helmet } from 'react-helmet';
import { useSiteMetadata } from './useSiteMetadataHook';

type SeoProps = {
    title?: string;
    description?: string;
    pathname?: string;
    children?: React.ReactNode;
};

export const Seo: FC<SeoProps> = ({
    title,
    description,
    pathname,
    children,
}) => {
    const {
        title: defaultTitle,
        description: defaultDescription,
        image,
        url: siteUrl,
    } = useSiteMetadata();

    const seo = {
        title: title || defaultTitle,
        description: description || defaultDescription,
        image: `${siteUrl}${image}`,
        url: `${siteUrl}${pathname || ''}`,
    };

    return (
        <Helmet>
            <title>{seo.title}</title>
            <meta name="description" content={seo.description} />
            <meta name="image" content={seo.image} />

            <link
                rel="icon"
                href={seo.image}
            />
            {children}
        </Helmet>
    );
};
