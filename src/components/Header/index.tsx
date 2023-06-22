import React from 'react';
import TSLogo from '../../assets/svg/ts-logo-white-developer.svg';
import t from '../../utils/lang-utils';
import Dropdown from '../Dropdown';
import Menu from '../Menu';
import './index.scss';

const Header = (props: { location: Location }) => {
    const headerLinks = [
        {
            name: 'APIs and SDK',
            href: '?pageid=apis-sdk',
            child: [
                { label: 'Embed Analytics', link: 'embed-analytics' },
                { label: 'Rest Apis', link: 'rest-apis' },
                { label: 'Customize Links', link: 'customize-links' },
            ],
        },
        {
            name: 'CodeSpot',
            child: [
                {
                    label: 'CodeSpot',
                    link: 'https://developers.thoughtspot.com/codespot/',
                    external: true,
                },
                { label: 'VisualEmbedSdk', link: 'VisualEmbedSdk' },
            ],
        },
        {
            name: 'Playground',

            child: [{ label: 'Play Ground 2.0', link: 'restV2-playground' }],
        },
        {
            name: 'Product Guides',
        },
        {
            name: 'Community',
        },
    ];

    return (
        <header>
            <section className="containerWrapper">
                <div className="headerWrapper">
                    <div>
                        <h2 className="m-0 d-inline-block logo">
                            <a
                                href="?pageid=introduction"
                                title={t('TS_LOGO_ALT_TEXT')}
                            >
                                <img
                                    src={TSLogo}
                                    alt={t('TS_LOGO_ALT_TEXT')}
                                    className="thoughtspotLogo"
                                />
                            </a>
                        </h2>
                    </div>
                    <Menu config={headerLinks} />

                    {/* <div className="d-inline-block headerLink">
                            {headerLinkSelf.map(({ name, href }) => (
                                <a href={href}>{name}</a>
                            ))}
                        </div> */}
                    {/* <div className="d-inline-block headerLink">
                            {headerLinks.map(({ name, href }) => (
                                <a href={href} target="_blank">
                                    {name}
                                </a>
                            ))}
                        </div> */}
                    <Dropdown location={props.location} />
                </div>
            </section>
        </header>
    );
};

export default Header;
