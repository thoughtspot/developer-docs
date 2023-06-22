import React from 'react';
import TSLogo from '../../assets/svg/ts-logo-white-developer.svg';
import t from '../../utils/lang-utils';
import Dropdown from '../Dropdown';
import Menu from '../Menu';
import './index.scss';

const Header = (props: { location: Location }) => {
    const headerLinks = [
        {
            name: 'APIs & SDKs',
            href: '',
            child: [
                { label: 'Visual Embed SDK', link: 'VisualEmbedSdk' },
                { label: 'REST API', link: 'rest-apis' },
                { label: '', link: '' },
            ],
        },
        {
            name: 'Playground',
            child: [
                {
                    label: 'Visual Embed',
                    link: 'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/playground/search',
                    external: true
                },
                {
                    label: 'REST API',
                    link: 'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/rest/playgroundV2_0',
                    external: true
                },
                {   label: 'GraphQL',
                    link: 'https://try-everywhere.thoughtspot.cloud/v2/#/everywhere/api/graphql/playground',
                    external: true
                },
            ],
        },
        {
            name: 'Resources',
            child: [
                    {
                       label: 'Community',
                       link: 'https://community.thoughtspot.com/customers/s/topic/0TO3n000000erVyGAI/developers-embedding',
                       external: true
                    },
                    {
                       label: 'Product documentation',
                       link: 'https://docs.thoughtspot.com',
                       external: true
                    },
                    {
                       label: 'Support',
                       link: 'https://www.thoughtspot.com/support',
                       external: true
                    },
            ]
        },
        {
            name: 'On GitHub',
            child: [
                     {
                         label: 'Visual Embed SDK',
                         link: 'https://github.com/thoughtspot/visual-embed-sdk',
                         external: true
                     },
                     {
                         label: 'REST API SDK',
                         link: 'https://github.com/thoughtspot/rest-api-sdk',
                         external: true
                     },
              ]
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
