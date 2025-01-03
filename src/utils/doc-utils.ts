import { BUILD_ENVS, SITE_PREFIX } from '../configs/doc-configs';

const buildJSON = (element) => {
    const parentElement = element?.children;
    const subObj: any = {
        name: parentElement[0]?.textContent?.trim(),
        href: parentElement[0]?.querySelector('a')?.getAttribute('href'),
    };

    if (parentElement?.length > 1 && parentElement[1]?.querySelector('ul')) {
        Array.from(parentElement[1].querySelector('ul').children).forEach(
            (eachElement) => {
                if (!subObj.children) {
                    subObj.children = [];
                }
                subObj.children.push(buildJSON(eachElement));
            },
        );
    }
    return subObj;
};

const getPathPrefix = () => {
    return process.env.NODE_ENV === BUILD_ENVS.LOCAL ? '' : SITE_PREFIX;
};

export const getPath = (path) =>
    getPathPrefix() ? `${path}/${getPathPrefix()}` : path;

export const fetchChild = (html: string) => {
    if (typeof window === 'undefined') {
        return [];
    }
    const divElement = document.createElement('div');
    divElement.innerHTML = html;
    const data = Array.from(
        divElement.querySelectorAll('ul.navSection > li'),
    ).map((element) => buildJSON(element));

    return data;
};

// Not being used anywhere
const getParentHref = (current) => {
    if (current.href) {
        return current.href;
    }
    if (current?.children?.length > 1) {
        return current.children[0]?.href;
    }
    return null;
};

export const getBreadcrumsPath = (data: any, pageid?: string) => {
    if (!pageid) {
        return [];
    }

    return data.reduce((previous, current) => {
        if (
            current.href === `?pageid=${pageid}` ||
            current.href === `/${SITE_PREFIX}/${pageid}`
        ) {
            // To avoid having link for the same page we are setting href to null
            return [{ name: current.name, href: null }];
        }
        if (current.children) {
            const parentObj = [
                { name: current.name, href: getParentHref(current) },
            ];
            const childObj = getBreadcrumsPath(current.children, pageid);
            if (childObj.length) {
                return [...parentObj, ...childObj];
            }
        }
        if (previous.length) {
            return previous;
        }
        return [];
    }, []);
};

/**
 * Used to parse html by replace all passThroughKeys with corresponding replacement values.
 * @param {string} html - raw html content
 * @param {object} params - json object containing passThroughKey: replacementValue pairs
 * @returns {string} parsed html content
 */
export const passThroughHandler = (html: string, params: object) => {
    let parsedHtml = html;
    const paramKeys = Object.keys(params);
    if (!html && paramKeys.length === 0) return parsedHtml;

    // During document processing, the character replacement step converts textual characters to the decimal format of their Unicode code points. 
    // This causes the '--' to be replaced with the em-dash (&#8212;) followed by a zero-width space (&#8203;). Ref : https://docs.asciidoctor.org/asciidoc/latest/subs/replacements/
    parsedHtml = parsedHtml.replace(/&#8212;&#8203;/g, '--');
    const customPassThroughStart = '{{';
    const customPassThroughEnd = '}}';

    paramKeys.map((key) => {
        parsedHtml = parsedHtml.replace(
            new RegExp(
                `${customPassThroughStart}${key}${customPassThroughEnd}`,
                'g',
            ),
            params[key] || '',
        );
    });

    return parsedHtml;
};
