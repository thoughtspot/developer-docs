import * as React from 'react';
import BackButton from '../../BackButton';

export const ThemeBuilder: React.FC<ThemeBuilderProps> = (props) => {
    const playgroundUrl = 'https://theme-builder-embed-prod.vercel.app/';

    return (
        <div className="restApiWrapper">
            <BackButton
                title="Back"
                backLink={props.backLink}
                internalRedirect
            />
            <iframe
                ref={null}
                src={playgroundUrl}
                height="100%"
                width="100%"
                id="theme-builder"
            />
        </div>
    );
};

type ThemeBuilderProps = {
    backLink: string;
};
