import React from 'react';
import './index.scss';

type AnnouncementBannerProps = {
    enabled?: boolean;
    message: React.ReactNode;
};

const AnnouncementBanner = (props: AnnouncementBannerProps) => {
    const { enabled = true, message } = props;

    if (!enabled) return null;

    return (
        <div className="announcementBanner" role="region" aria-label="Announcement">
            <div className="containerWrapper announcementBanner__inner">
                <div className="announcementBanner__content">{message}</div>
            </div>
        </div>
    );
};

export default AnnouncementBanner;

