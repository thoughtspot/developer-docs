const getTutorialLinkFromEdge = (edge) => {
    // Tutorials module pageids follow pattern {subdirectory}_{final_url_stub}
    // to give unique IDs in system but allow directory structure in URL
    const { pageid: pageId } = edge.node.pageAttributes;
    const { relativePath: relPath } = edge.node.parent;
    // One-level of subdirectory part of stub
    const relPathSplit = relPath.split('/');
    const pageIdSplit = pageId.split('__');
    let finalPageId = pageId;
    if (pageIdSplit.length > 1) {
        finalPageId = pageIdSplit[1];
    }

    let finalPath = `/tutorials/${finalPageId}`;
    if (relPathSplit.length > 1) {
        finalPath = `/tutorials/${relPathSplit[0]}/${finalPageId}`;
    }

    return finalPath;
};

const getDocLinkFromEdge = (edge) => {
    const { pageid: pageId } = edge.node.pageAttributes;
    const { sourceInstanceName: sourceName } = edge.node.parent;

    if (sourceName === 'tutorials') {
        return getTutorialLinkFromEdge(edge);
    }

    return `/${pageId}`;
};

module.exports = {
    getDocLinkFromEdge,
};
