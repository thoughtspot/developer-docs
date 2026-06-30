import React, { FC } from 'react';
import { useSiteMetadata } from './useSiteMetadataHook';

type SeoProps = {
    title?: string;
    description?: string;
    pathname?: string;
    children?: React.ReactNode;
};

// Asciidoctor converts typographic characters to HTML entities (e.g. ' → &#8217;).
// React escapes & in text nodes, so entities double-encode and show literally in the tab.
const decodeHtmlEntities = (str: string): string =>
    str
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
        )
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

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
        title: decodeHtmlEntities(title || defaultTitle),
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
