import React, { useState, useEffect } from 'react';
import { MdClose } from '@react-icons/all-files/md/MdClose';
import { IconContext } from '@react-icons/all-files';
import './index.scss';

type BannerVariant = 'release' | 'info';

type AnnouncementBannerProps = {
    enabled?: boolean;
    message: React.ReactNode;
    variant?: BannerVariant;
    dismissKey?: string;
};

const AnnouncementBanner = (props: AnnouncementBannerProps) => {
    const { enabled = true, message, variant = 'release', dismissKey = 'announcement-banner' } = props;
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const isDismissed = sessionStorage.getItem(dismissKey) === 'dismissed';
        setDismissed(isDismissed);
    }, [dismissKey]);

    const handleDismiss = () => {
        sessionStorage.setItem(dismissKey, 'dismissed');
        setDismissed(true);
    };

    if (!enabled || dismissed) return null;

    return (
        <div
            className={`announcementBanner announcementBanner--${variant}`}
            role="region"
            aria-label="Announcement"
        >
            <div className="containerWrapper announcementBanner__inner">
                <div className="announcementBanner__content">{message}</div>
                <button
                    className="announcementBanner__close"
                    onClick={handleDismiss}
                    aria-label="Dismiss announcement"
                    title="Dismiss"
                >
                    <IconContext.Provider value={{ className: 'close-icon' }}>
                        <MdClose />
                    </IconContext.Provider>
                </button>
            </div>
        </div>
    );
};

export default AnnouncementBanner;
