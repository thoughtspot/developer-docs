import React, { useState, useEffect, FC } from 'react';
import _ from 'lodash';
import BackButton from '../BackButton';



const RenderPlayGround: FC = () => {
  
    const playgroundRef = React.useRef<HTMLIFrameElement>(null);
    const playgroundUrl =
        'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/graphql/playground';

    return (
        <div className="restApiWrapper">
            <BackButton title="Back" backLink="rest-api-v2" />

            <iframe
                ref={playgroundRef}
                src={playgroundUrl}
                height="100%"
                width="100%"
                id="restAPIPlayGround"
            />
        </div>
    );
};

export default RenderPlayGround;
