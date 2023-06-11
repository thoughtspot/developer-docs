const { JSDOM } = require('jsdom');
const { htmlToText } = require('html-to-text');
const config = require('../configs/doc-configs');
const { getAlgoliaIndex } = require('../configs/algolia-search-config');

const getPathPrefix = () => {
    return 'docs';
};

const getPath = (path) =>
    getPathPrefix() ? `${path}/${getPathPrefix()}` : path;

const stripLinks = (text) => {
    if (text) {
        const re = /<a\s.*?href=[\"\'](.*?)[\"\']*?>(.*?)<\/a>/g;
        const str = text;
        const subst = '$2';
        const result = str.replace(re, subst);
        return result;
    }
    return '';
};

const getTextFromHtml = (html) => {
    const text = htmlToText(`${html}`, {
        selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'h1', format: 'skip' },
            { selector: 'h2', format: 'skip' },
            { selector: 'h3', format: 'skip' },
        ],
    });
    return text;
};

const pageQuery = `
query {
  allAsciidoc(sort: { fields: [document___title], order: ASC }) {
      edges {
          node {
              id
              document {
                title
              }
              pageAttributes {
                  pageid
                  title
                  description
              }
              html       
          }
      }
  }
  allFile(filter: {sourceInstanceName: {eq: "htmlFiles"}}) {
    edges {
        node {
            id
            extension
            dir
            name
            relativePath
            childHtmlRehype {
              html
              htmlAst
            }
        }
    }
  }
}
`;

function splitStringIntoChunks(input, n) {
    const chunkSize = Math.ceil(input.length / n);
    const result = [];

    for (let i = 0; i < input.length; i += chunkSize) {
        const chunk = input.slice(i, i + chunkSize);
        result.push(chunk);
    }

    return result;
}

const pageToAlgoliaRecordForASCII = (ele, type, node) => {
    const pageid = node.pageAttributes.pageid;
    let sectionId;
    let sectionTitle;
    if (type === 'section') {
        sectionId = ele.querySelector('h2').id;
        sectionTitle = ele.querySelector('h2').innerHTML;
    } else {
        sectionId = type;
        sectionTitle = node.document.title;
    }

    const body = ele && getTextFromHtml(ele.innerHTML);
    const len = new TextEncoder().encode(body).length;

    const numberOfChunks = len / 8000 + 1;
    const chunks = splitStringIntoChunks(body, numberOfChunks);

    return chunks.map((chunk, i) => ({
        objectID: `${node.id + sectionId}chunk_${i}`,
        sectionId,
        sectionTitle,
        body: chunk,
        pageid,
        type: 'ASCII',
        title: node.document.title,
        link: `/${pageid}`,
    }));
};

const queries = [
    {
        query: pageQuery,
        transformer: ({ data }) => {
            const data1 = [
                ...data.allAsciidoc.edges
                    .filter(
                        (edge) =>
                            edge.node.pageAttributes.pageid &&
                            edge.node.pageAttributes.pageid !== 'nav',
                    )
                    .reduce((acc, edge) => {
                        const newDiv = new JSDOM(`<div>${edge.node.html}</div>`)
                            .window.document;
                        const preambleEle = newDiv.querySelector('#preamble');
                        const preamble = preambleEle
                            ? pageToAlgoliaRecordForASCII(
                                  preambleEle,
                                  'preamble',
                                  edge.node,
                              )
                            : null;
                        const sections = Array.prototype.map.call(
                            newDiv.querySelectorAll('.sect1'),
                            (sect) =>
                                pageToAlgoliaRecordForASCII(
                                    sect,
                                    'section',
                                    edge.node,
                                ),
                        );
                        if (preamble) {
                            acc = [...acc, ...preamble];
                        }
                        return [
                            ...acc,
                            ...sections.reduce(
                                (accR, e) => [...accR, ...e],
                                [],
                            ),
                        ];
                    }, []),
            ];

            console.log('hihii', data1.length);
            return data1;
        },
        indexName: getAlgoliaIndex(),
        settings: {
            attributesToSnippet: ['body:10'],
        },
    },
];

module.exports = {
    queries,
    pageToAlgoliaRecordForASCII,
};
