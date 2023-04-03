import { graphql } from 'gatsby';
import React, { useEffect, useState, useRef } from 'react';
import Docmap from '../Docmap';
import Document from '../Document';

export default function TestPage({ data }) {
    const { document, pageAttributes, html } = data.asciidoc;
    const location = {} as Location;
    return (
        <div className="introWrapper">
            <Document
                shouldShowRightNav={true}
                pageid={'12'}
                docTitle={pageAttributes.title}
                docContent={html}
                breadcrumsData={['breadcrumsData']}
                isPublicSiteOpen={true}
            />
            {true && (
                <div>
                    <Docmap
                        docContent={'docContent'}
                        location={location}
                        options={[]}
                    />
                </div>
            )}
        </div>
    );
}
export const query = graphql`
    query MyQuery($slug: String) {
        asciidoc(pageAttributes: { pageid: { eq: $slug } }) {
            document {
                title
            }
            pageAttributes {
                title
                pageid
                description
            }
            html
        }
    }
`;
