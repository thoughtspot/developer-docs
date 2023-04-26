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
    
    // Uses helmet to put tags in header
    return (
        <Helmet>
            <title>{seo.title}</title>
            <meta name="description" content={seo.description} />
            <meta name="image" content={seo.image} />

            <link
                rel="icon"
                href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>👤</text></svg>"
            />
            {children}
        </Helmet>
    );
};
