import React from 'react';
import { HOME_PAGE_ID } from '../../configs/doc-configs';
import { getBreadcrumsPath } from '../../utils/doc-utils';
import './index.scss';

type BreadcrumsProps = {
    pageid?: string;
    breadcrumsData: any;
    // Individual walkthrough step pages use compound pageids
    // ({subdir}__{finalSegment}) that only ever match the leaf node in
    // nav-walkthroughs.adoc's own list, not the "Walkthroughs" entry that lives
    // in nav.adoc — so there's no way back to the overview from a step page
    // other than this explicit crumb.
    showWalkthroughsCrumb?: boolean;
};

const Breadcrums: React.FC<BreadcrumsProps> = (props: BreadcrumsProps) => {
    const breadcrums = getBreadcrumsPath(props.breadcrumsData, props.pageid);
    return (
        <>
            {breadcrums.length ? (
                <div
                    data-testid="breadcrumbWrapper"
                    className="breadcrumsWrapper"
                >
                    <ul className="breadcrumb">
                        <li>
                            <a href={`/docs/${HOME_PAGE_ID}`}>
                                Developer Guides
                            </a>
                        </li>
                        {props.showWalkthroughsCrumb && (
                            <li>
                                <a href="/docs/tutorials/walkthroughs">
                                    Walkthroughs
                                </a>
                            </li>
                        )}
                        {breadcrums.map(({ name, href }) => (
                            <li key={`${name}-${href}`}>
                                {href ? <a href={href}>{name}</a> : name}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </>
    );
};

export default Breadcrums;
