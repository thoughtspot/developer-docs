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
        <>
            <title>{seo.title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="description" content={seo.description} />
            <meta name="image" content={seo.image} />
            <meta name="og:title" content={seo.title} />
            <meta name="og:description" content={seo.description} />
            <meta name="og:url" content={seo.url} />
            <meta name="og:image" content={seo.image} />
            <meta name="og:type" content="website" />
            <link rel="icon" href={seo.image} />
            {children}
        </>
    );
};
