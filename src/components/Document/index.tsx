import React, { useEffect } from 'react';
import './index.scss';
import { customizeDocContent, addScrollListener } from './helper';
import Footer from '../Footer';
import Breadcrums from '../Breadcrums';
import LinkableHeader from '../LinkableHeader';
import WasThisHelpful from '../WasThisHelpful';
import CopyPageDropdown from '../CopyPageDropdown';
import { HOME_PAGE_ID } from '../../configs/doc-configs';
import parse, { HTMLReactParserOptions, domToReact, attributesToProps } from 'html-react-parser';

const Document = (props: {
    pageid?: string;
    docTitle: string;
    docContent: string;
    isPublicSiteOpen: boolean;
    shouldShowRightNav: boolean;
    breadcrumsData: any;
    markdownBody?: string;
}) => {
    useEffect(() => {
        customizeDocContent();
    }, [props.docContent]);

    useEffect(() => {
        addScrollListener();
    }, []);

    const options: HTMLReactParserOptions = {
        replace: (domNode: any) => {
            if (domNode.type === 'tag' &&
                ['h2', 'h3', 'h4'].includes(domNode.name) &&
                !domNode.parent?.attribs?.class?.includes('non-link')
            ) {
                const nodeProps = attributesToProps(domNode.attribs);
                return (<LinkableHeader {...nodeProps} tag={domNode.name} id={domNode.attribs.id}>
                    {domToReact(domNode.children, options)}
                </LinkableHeader>)
            }
            return undefined;
        }
    };

    const isHomePage = props.pageid === HOME_PAGE_ID;

    return (
        <div
            className="documentWrapper"
            style={!props.shouldShowRightNav ? { width: '100%' } : undefined}
        >
            {!isHomePage && (
                <Breadcrums
                    breadcrumsData={props.breadcrumsData}
                    pageid={props.pageid}
                />
            )}
            {!isHomePage && (
                <div className="document-toolbar">
                    <CopyPageDropdown pageTitle={props.docTitle} markdownBody={props.markdownBody} />
                </div>
            )}
            <div
                id={props.docTitle}
                className="documentView"
            >
                {parse(props.docContent, options)}
            </div>
            {!isHomePage && props.isPublicSiteOpen && (
                <WasThisHelpful />
            )}
            {props.isPublicSiteOpen && <Footer />}
        </div>
    );
};

export default Document;
