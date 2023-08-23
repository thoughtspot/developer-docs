import React, { useState, useEffect, FC } from 'react';

import { DEFAULT_HOST } from '../../configs/doc-configs';
import BackButton from '../BackButton';

const GraphQLPlayGround: FC<GraphQLPlayGroundProps> = (props) => {
    const isBrowser = () => typeof window !== 'undefined';
    const { isPublisSiteOpen, location, backLink } = props;

    const getParentURL = () => {
        let parentUrl = location?.origin;
        if (isBrowser()) {
            const { ancestorOrigins } = window?.location;
            parentUrl =
                ancestorOrigins?.length > 0
                    ? ancestorOrigins[ancestorOrigins?.length - 1]
                    : document.referrer || window?.origin;
        }
        return parentUrl;
    };
    const baseUrl = isPublisSiteOpen ? DEFAULT_HOST : getParentURL();
    const playgroundUrl = baseUrl + '/api/graphql/2.0';

    return (
        <div className="restApiWrapper">
            <BackButton title="Back" backLink={backLink} internalRedirect />
            <iframe
                ref={null}
                src={playgroundUrl}
                height="100%"
                width="100%"
                id="restAPIPlayGround"
            />
        </div>
    );
};

export default GraphQLPlayGround;

type GraphQLPlayGroundProps = {
    location: Location;
    isPublisSiteOpen: boolean;
    backLink: string;
};
