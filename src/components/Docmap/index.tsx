import React, { useEffect, useState } from 'react';
import { INTRO_WRAPPER_MARGIN_TOP } from '../../constants/uiConstants';
import t from '../../utils/lang-utils';
import './index.scss';

const Docmap = (props: {
    docContent: string;
    options: Object[];
    location: Location;
}) => {
    const [toc, setToc] = useState('');
    useEffect(() => {
        // GraphQL doesn't provide any seperate html for Table of Content. It is included in the document itself.
        // To extract the TOC from document, we first create a temporary element to set the document as it's innerHTML.
        // Them we search for TOC using querySelector on the temporary element and then set the obtained TOC to display in the UI.
        const doc = document.createElement('div');
        doc.innerHTML = props.docContent;
        const tocEl = doc.querySelector('#toc');
        if (tocEl) {
            const { hash } = props.location;
            if (hash) {
                const ele = document.querySelector(hash);
                if (ele) {
                    ele.scrollIntoView({
                        block: 'start',
                    });
                }
            }
            setToc(tocEl.innerHTML);
        } else {
            setToc('');
        }
    }, [props.docContent, props.location.hash]);

    // Currently not using
    // const toggleActiveClass = (toc: Element, href: string) => {
    //     toc.querySelectorAll('a').forEach((tag, index) => {
    //         const temp = tag;
    //         if (tag.getAttribute('href') === href) {
    //             temp.classList.add('activeTag');
    //         } else if (tag.classList.contains('activeTag')) {
    //             temp.classList.remove('activeTag');
    //         }
    //         toc.querySelectorAll('a')[index].innerHTML = temp.innerHTML;
    //     });
    //     return toc;
    // };

    return (
        toc !== '' && (
            <div className="docmapLinks">
                <p className="tocTitle">{t('RIGHT_NAV_SIDERBAR_TITLE')}</p>
                <div
                    data-testid="toc"
                    dangerouslySetInnerHTML={{ __html: toc }}
                />
            </div>
        )
    );
};

export default Docmap;
