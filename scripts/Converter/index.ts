const path = require('path');
const fs = require('fs');
const nodeFetch = require('node-fetch');

enum TypeDocReflectionKind {
    Project = 'Project',
    Module = 'Module',
    Namespace = 'Namespace',
    Enumeration = 'Enumeration',
    EnumerationMember = 'Enumeration member',
    Variable = 'Variable',
    Function = 'Function',
    Class = 'Class',
    Interface = 'Interface',
    Constructor = 'Constructor',
    Property = 'Property',
    Method = 'Method',
    CallSignature = 'Call signature',
    IndexSignature = 'Index signature',
    ConstructorSignature = 'Constructor signature',
    Parameter = 'Parameter',
    TypeLiteral = 'Type literal',
    TypeParameter = 'TypeParameter',
    Accessor = 'Accessor',
    GetSignature = 'GetSignature',
    SetSignature = 'SetSignature',
    ObjectLiteral = 'ObjectLiteral',
    TypeAlias = 'Type alias',
    Reference = 'Reference',
}

interface TypeDocCommentTag {
    tag: string;
    text: string;
}

interface TypeDocSource {
    fileName: string;
    line: number;
    character: number;
}

interface TypeDocNode {
    id: number;
    name: string;
    kind: number;
    kindString: TypeDocReflectionKind;
    sources?: TypeDocSource[];
    children?: TypeDocNode[];
    groups?: TypeDocGroup[];
    comment?: TypeDocComment;
    flags?: any;
}

interface TypeDocComment {
    shortText?: string;
    text?: string;
    returns?: string;
    tags?: TypeDocCommentTag[];
}

interface TypeDocGroup {
    title: string;
    kind: number;
    children: number[];
}

interface EnumerationMemberNode extends TypeDocNode {
    kindString: TypeDocReflectionKind.EnumerationMember;
    defaultValue: string;
}

interface ConstructorNode extends TypeDocNode {
    kindString: TypeDocReflectionKind.EnumerationMember;
    signatures: ConstructorSignatureNode[];
}
interface TypeDocType {
    type:
        | 'reference'
        | 'union'
        | 'intrinsic'
        | 'reflection'
        | 'array'
        | 'literal';
    id?: number;
    name?: string;
    types?: TypeDocType[];
    declaration?: TypeLiteralNode;
    typeArguments?: TypeDocType[];
    elementType?: TypeDocType;
    value?: string;
}
interface ConstructorSignatureNode extends TypeDocNode {
    kindString: TypeDocReflectionKind.ConstructorSignature;
    parameters: ParameterNode[];
    type: TypeDocType;
    overwrites: TypeDocType;
}

interface SignatureNode extends TypeDocNode {
    // Call signature, Method signature, Constructor signature
    parameters?: ParameterNode[];
    type: TypeDocType;
    overwrites?: TypeDocType;
    inheritedFrom?: TypeDocType;
}
interface FunctionNode extends TypeDocNode {
    signatures: SignatureNode[];
    overwrites?: TypeDocType;
    inheritedFrom?: TypeDocType;
}

interface ParameterNode extends TypeDocNode {
    type: TypeDocType;
    defaultValue?: string;
}

interface TypeLiteralNode extends TypeDocNode {
    signatures?: SignatureNode[];
    indexSignature?: SignatureNode;
}

interface TypeAliasNode extends TypeDocNode {
    type: TypeDocType;
}

interface TypeDocLinkingNode extends TypeDocNode {
    parentId?: number;
    signatures?: SignatureNode[];
}

const encodePageId = (pageId: string) => {
    // making pageId's great again
    return pageId.replace(/ /g, '%20');
};

// eslint-disable-next-line no-underscore-dangle
const _indent = (
    content: string,
    indentDelim: string,
    level: number,
): string => {
    if (!content || !indentDelim || !level) return content;

    const lines = content.split('\n');

    const indentChar = indentDelim.repeat(level);
    const updateLines = lines.map((line) => {
        if (line) return `${indentChar}\n${line}`;
        return line;
    });

    return updateLines.join('\n');
};

// All the parse functions are to be used internally (its used to get sub content)
class TypeDocInternalParser {
    static convertToItalic = (name: string | undefined) =>
        name ? `_${name}_` : '';

    static convertNameToLink: (node: string | undefined) => string;

    static GITHUB_LINK =
        'https://github.com/thoughtspot/visual-embed-sdk/blob/main/src';

    static covertTypeDocText = (text: string) => {
        // convert all {@link Name.hash}
        // to xref:Name.adoc#hash[Name]
        const matches = text.match(/{@link [^{]+}/g);
        if (!matches) return text;
        const updatedText = matches?.reduce((prevUpdatedText, curLinkText) => {
            const linkTo = curLinkText.split(' ')[1].replace('}', '');
            const newLinkText = this.convertNameToLink(linkTo);

            if (!newLinkText) return prevUpdatedText;

            return prevUpdatedText.replace(curLinkText, newLinkText);
        }, text);

        return updatedText;
    };

    // function to parse a tag
    static parseTag(tag: TypeDocCommentTag): string {
        if (!tag.tag.trim() || !tag.text.trim()) {
            console.log('\t', 'Tag skipped ', JSON.stringify(tag));
            return '';
        }
        if (tag.tag === 'group') return '';
        if (tag.tag === 'version')
            return `[version]#Version : ${tag.text.replace(/\n/g, '')}#\n`;
        if (tag.tag === 'example') return `${tag.text}\n`;

        if (tag.tag === 'param') {
            return `\nParameter::\n${tag.text}\n`;
        }

        if (tag.tag === 'tryItOut') {
            return `++++\n<a href="{{previewPrefix}}${tag.text}" id="preview-in-playground" target="_blank">Try it out</a>\n++++\n`;
        }

        return `\n\`${tag.tag}\` : ${this.covertTypeDocText(tag.text)} \n`;
    }

    static parseComment(comment: TypeDocComment | undefined): string {
        if (!comment) return '';

        let content = '';
        content += this.covertTypeDocText(
            `${comment?.shortText?.trim() || ''}\n${
                comment?.text?.trim() || ''
            }\n\n`,
        );

        return content;
    }

    static parseTags(tags: TypeDocCommentTag[] | undefined) {
        // process tags
        let content = '';

        if (tags) {
            tags.forEach((tag) => {
                content += `\n${this.parseTag(tag)}\n\n`;
            });
        }

        return content;
    }

    static parseSources = (sources: TypeDocSource[] | undefined) => {
        if (!sources) return '';

        return sources
            .map(
                (source) =>
                    `[definedInTag]#Defined in : link:${this.GITHUB_LINK}/${source.fileName}#L${source.line}[${source.fileName}, window=_blank]#`,
            )
            .join('\n');
    };

    // TODO : better handling for typeArg
    static parseTypeDocType = (
        node: TypeDocType | undefined,
        link = false,
    ): string => {
        let typeArg = '';
        if (!node) return '';

        if (node.typeArguments && node.typeArguments.length) {
            typeArg = `< ${node.typeArguments
                ?.map((type) => this.parseTypeDocType(type, link))
                .join(', ')} >`;
        }

        switch (node.type) {
            case 'literal':
                if (link) return this.convertToItalic(node.name);
                return `"${node.value}"`;
            case 'intrinsic':
                if (link)
                    return this.convertToItalic(node.name) + typeArg || '';
                return node.name + typeArg || '';
            case 'reference': {
                // since code block doesn't support links
                if (link) {
                    return this.convertNameToLink(node.name) + typeArg;
                }
                return node.name + typeArg || '';
            }
            case 'union': {
                return (
                    node.types
                        ?.map((type) => this.parseTypeDocType(type, link))
                        .join(' | ') + typeArg || ''
                );
            }
            case 'reflection': {
                return (
                    this.parseTypeLiteralNode(node.declaration, link) + typeArg
                );
            }
            case 'array': {
                return `${
                    this.parseTypeDocType(node.elementType, link) + typeArg
                }[]`;
            }
            default: {
                console.error(`${node.type} not handled`);
                return node.name || '';
            }
        }
    };

    // handles both call and constructor signature
    static parseCallSignature = (node: SignatureNode, link?: boolean) => {
        return `(${this.parseParameters(
            node.parameters,
            link,
        )}) : ${this.parseTypeDocType(node.type, link)}`;
    };

    static parseIndexSignatures = (node: SignatureNode, link?: boolean) => {
        return `{[${this.parseParameters(
            node.parameters,
            link,
        )}] : ${this.parseTypeDocType(node.type, link)}}`;
    };

    static parseTypeLiteralNode = (
        node: TypeLiteralNode | undefined,
        link?: boolean,
    ) => {
        // 3 types
        if (!node) return '';

        if (node.indexSignature) {
            return this.parseIndexSignatures(node.indexSignature, link);
        }
        if (node.signatures) {
            return node.signatures
                .map((sig) => this.parseCallSignature(sig, link))
                .join('\n\n');
        }
        if (node.children) {
            return `{${this.parseParameters(
                node.children as ParameterNode[],
                link,
            )}}`;
        }
        console.error(
            `No handler defined for : ${node.kindString}, Name : ${node.name}`,
        );
        return '';
    };

    static parseParameters = (
        parameters: ParameterNode[] | undefined,
        link?: boolean,
    ) => {
        if (!parameters) return '';
        return parameters
            .map((param) => {
                const isOptional =
                    param.defaultValue !== undefined || param.flags?.isOptional
                        ? '?'
                        : '';

                const defaultValue =
                    param.defaultValue !== undefined
                        ? `= ${param.defaultValue}`
                        : '';
                return `${param.name}${isOptional}: ${this.parseTypeDocType(
                    param.type,
                    link,
                )} ${defaultValue}`;
            })
            .join(', ');
    };
}

// To get the main content use the handleNode function
class TypeDocParser {
    private childrenIdMap: Record<number, TypeDocLinkingNode> = {};

    private childrenNameMap: Record<string, TypeDocLinkingNode> = {};

    private groupMap: Record<string, TypeDocLinkingNode[]> = {};

    public convertNameToLink = (linkTo: string | undefined) => {
        if (!linkTo) return '';

        const [name, hash] = linkTo.split('.');

        const hashNode = this.childrenNameMap[hash || ''];

        if (hashNode) return this.convertNodeToLink(hashNode);

        const nameNode = this.childrenNameMap[name || ''];

        if (nameNode) return this.convertNodeToLink(nameNode);

        return hash || name;
    };

    private parseTypeDocType = (
        node: TypeDocType | undefined,
        link = false,
    ): string => {
        let typeArg = '';
        if (!node) return '';

        if (node.typeArguments && node.typeArguments.length) {
            typeArg = `< ${node.typeArguments
                ?.map((type) => this.parseTypeDocType(type, link))
                .join(', ')} >`;
        }

        switch (node.type) {
            case 'literal':
                if (link)
                    return TypeDocInternalParser.convertToItalic(node.name);
                return `"${node.value}"`;
            case 'intrinsic':
                if (link)
                    return (
                        TypeDocInternalParser.convertToItalic(node.name) +
                            typeArg || ''
                    );
                return node.name + typeArg || '';
            case 'reference': {
                // since code block doesn't support links
                if (link) {
                    const nodeToLink = this.childrenNameMap[node.name || ''];
                    if (nodeToLink) {
                        return this.convertNodeToLink(nodeToLink);
                    }
                    // console.log('\t', node.name, 'not found in map');
                    // return (
                    //     TypeDocInternalParser.convertNameToLink(node.name) +
                    //     typeArg
                    // );
                }
                return node.name + typeArg || '';
            }
            case 'union': {
                return (
                    node.types
                        ?.map((type) => this.parseTypeDocType(type, link))
                        .join(' | ') + typeArg || ''
                );
            }
            case 'reflection': {
                return (
                    TypeDocInternalParser.parseTypeLiteralNode(
                        node.declaration,
                        link,
                    ) + typeArg
                );
            }
            case 'array': {
                return `${
                    this.parseTypeDocType(node.elementType, link) + typeArg
                }[]`;
            }
            default: {
                console.error(`${node.type} not handled`);
                return node.name || '';
            }
        }
    };

    private getHeadingString = (options: {
        toc?: boolean;
        tocLevel?: number;
        title: string;
        pageId: string;
        description?: string;
    }) => {
        const {
            toc = true,
            tocLevel = 2,
            title,
            pageId,
            description = '',
        } = options;
        return [
            `:toc: ${toc}`,
            `:toclevels: ${tocLevel}`,
            `:page-title: ${title}`,
            `:page-pageid: ${pageId}`,
            `:page-description: ${description.replace(/\n/g, ' ')}`,
        ].join('\n');
    };

    private createTypeDocTable = (
        data: string[],
        noOfColumns: number,
    ): string => {
        let content = `[cols="${'1,'.repeat(noOfColumns - 1)}1"]\n|===\n`;
        data.forEach((str) => {
            content += `| ${str}\n`;
        });

        for (let i = 0; i < noOfColumns - 1; i++) {
            content += '| \n';
        }
        content += '|===\n';
        return content;
    };

    private generateMap = (node: TypeDocLinkingNode) => {
        const groupTag =
            node.comment?.tags?.filter((e) => e.tag === 'group')[0] ||
            node?.signatures?.[0].comment?.tags?.filter(
                (e) => e.tag === 'group',
            )[0];
        if (groupTag) {
            if (!this.groupMap[groupTag.text])
                this.groupMap[groupTag.text] = [];
            this.groupMap[groupTag.text].push(node);
        }
        if (!this.childrenIdMap[node.id]) this.childrenIdMap[node.id] = node;
        if (!this.childrenNameMap[node.name])
            this.childrenNameMap[node.name] = node;
        node?.children?.forEach((childNode) => {
            const child = childNode as TypeDocLinkingNode;
            child.parentId = node.id;
            this.childrenIdMap[child.id] = child;
            this.childrenNameMap[child.name] = child;
            this.generateMap(child);
        });
    };

    private convertNodeToLink = (node: TypeDocNode) => {
        const parent = this.childrenIdMap[node.id]?.parentId;
        if (parent === undefined) return node.name;

        if (
            this.childrenIdMap[parent]?.kindString ===
            TypeDocReflectionKind.Project
        ) {
            return `[.typedoc-${node.kindString.replace(/ /g, '_')}]#xref:${
                node.name
            }.adoc[${node.name}]#`;
        }

        const grandParent = this.childrenIdMap[parent]?.parentId;
        if (grandParent === undefined) return node.name;

        if (
            this.childrenIdMap[grandParent]?.kindString ===
            TypeDocReflectionKind.Project
        ) {
            let newLinkText = `[.typedoc-${node.kindString.replace(
                / /g,
                '_',
            )}]#xref:${this.childrenIdMap[parent].name}.adoc`;
            newLinkText += `#_${node.name.toLowerCase()}`;
            newLinkText += `[${node.name}]#`;
            return newLinkText;
        }

        return '';
    };

    // handles the Main page nodes (Enum, Class, Interface, Type Alias)
    private handleMainNode = (node: TypeDocNode) => {
        const pageTitle = `= ${node.name}`;

        const mainPageContent = '';
        let enumIndexContent = '\n\n[div boxDiv boxFullWidth]\n--\n';
        // Special handling
        if (node.kindString === 'Enumeration','Class','Interface') {
            enumIndexContent += `${this.createTypeDocTable(
                node.children?.map(this.convertNodeToLink) || [],
                3,
            )}`;
        }
        enumIndexContent += '\n--\n\n';

        // Crate content for children ( Enum members , Parameters, Properties, etc..)
        const groupContent = node.groups
            ?.map((group) => {
                const groupHeading = `== ${group.title}`;
                return [
                    groupHeading,
                    ...group.children.map((id) => {
                        return this.convertTypeDocNode(this.childrenIdMap[id]);
                    }),
                ].join('\n\n');
            })
            .join('\n\n');

        return [
            pageTitle,
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.parseTags(node.comment?.tags),
            '== Index',
            enumIndexContent,
            mainPageContent,
            groupContent,
        ].join('\n\n');
    };

    private handleEnumMember = (enumMember: EnumerationMemberNode) => {
        // debugger;
        const sourceContent = TypeDocInternalParser.parseSources(
            enumMember.sources,
        );
        return [
            `=== ${enumMember.name}`,
            '[div typeDocBlock boxFullWidth]\n--',
            `\`${enumMember.name}:= ${enumMember.defaultValue}\`\n`,
            TypeDocInternalParser.parseComment(enumMember.comment),
            sourceContent,
            TypeDocInternalParser.parseTags(enumMember.comment?.tags),
            '--',
        ].join('\n');
    };

    private handleFunctionNode = (node: FunctionNode) => {
        const name = node.name !== 'constructor' ? `=== ${node.name}` : '';

        let overwrites = '';
        if (node.overwrites) {
            overwrites = `[definedInTag]#Overrides ${this.parseTypeDocType(
                node.overwrites,
            )}#`;
        }

        let inheritedFrom = '';
        if (node.inheritedFrom) {
            inheritedFrom = `[definedInTag]#Inherited from  ${this.parseTypeDocType(
                node.inheritedFrom,
            )}#`;
        }

        const signatureContent = this.handleCallSignatureNodes(node.signatures);

        const sources = TypeDocInternalParser.parseSources(node.sources);

        return [
            name,
            TypeDocInternalParser.parseComment(node.comment),
            '[div typeDocBlock boxFullWidth]\n--',
            signatureContent,
            sources,
            overwrites,
            inheritedFrom,
            TypeDocInternalParser.parseTags(node.comment?.tags),
            '--',
        ].join('\n\n');
    };

    private handleParameterNode = (node: ParameterNode) => {
        return [
            `${node.name}::: ${node.flags.isOptional ? '_Optional_\n' : ''}`,
            `* ${node.name}: ${this.parseTypeDocType(node.type, true)}${
                node?.defaultValue ? ` = ${node.defaultValue}` : ''
            }`,
            TypeDocInternalParser.parseComment(node.comment),
            this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags),
        ].join('\n\n');
    };

    private handlePropertyNode = (node: ParameterNode) => {
        const sig = `\`${node.name}: ${this.parseTypeDocType(node.type, true)}${
            node?.defaultValue ? ` = ${node.defaultValue}` : ''
        }\``;

        return [
            `=== ${node.name}`,
            '[div typeDocBlock boxFullWidth]\n--',
            sig,
            // TODO : move this iwth aobve line
            node.flags.isOptional ? '_Optional_' : '',
            TypeDocInternalParser.parseComment(node.comment),
            this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags),
            '--\n',
        ].join('\n\n');
    };

    private handleCallSignatureNode = (node: SignatureNode) => {
        const parmContent = node.parameters
            ?.map(this.convertTypeDocNode)
            .join('\n\n');

        return [
            TypeDocInternalParser.parseComment(node.comment),
            node.parameters?.length ? '**Function Parameters**' : '',
            parmContent,
            '**Returns**',
            TypeDocInternalParser.parseTypeDocType(node.type, true),
            this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags),
        ].join('\n\n');
    };

    private handleCallSignatureNodes = (nodes: SignatureNode[]) => {
        let content = '';
        content += nodes
            .map((node) => {
                return [
                    `\`${node.name}${TypeDocInternalParser.parseCallSignature(
                        node,
                        true,
                    )}\``,
                    this.handleCallSignatureNode(node),
                ].join('\n\n');
            })
            .join('\n\n');

        return content;
    };

    private handleTypeLiteralNode = (node: TypeLiteralNode | undefined) => {
        if (!node) return '';

        let content = '';
        if (node.indexSignature?.parameters) {
            content += 'Index Signature Parameters\n\n';
            node.indexSignature.parameters
                .map(this.convertTypeDocNode)
                .join('\n\n');
        } else if (node.signatures) {
            node.signatures.forEach((sigNode) => {
                content += `\`${TypeDocInternalParser.parseCallSignature(
                    sigNode,
                    true,
                )}\`\n\n`;
                content += `${this.handleCallSignatureNode(sigNode)}\n\n`;
            });
        } else if (node.children) {
            content += 'Parameters\n\n';
            content += node.children.map(this.convertTypeDocNode).join('\n\n');
        }

        return content;
    };

    private handleTypeNode = (node: TypeDocType | undefined) => {
        const content = [
            TypeDocInternalParser.parseComment(node?.declaration?.comment),
            TypeDocInternalParser.parseTags(node?.declaration?.comment?.tags),
            this.handleTypeLiteralNode(node?.declaration),
        ].join('\n\n');

        return content;
    };

    private handleTypeAliasNode = (node: TypeAliasNode) => {
        return [
            `= ${node.name}`,
            `\`${node.name} : ${this.parseTypeDocType(node.type, true)}\``,
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.parseSources(node.sources),
            `${this.handleTypeNode(node.type)}`,
        ].join('\n\n');
    };

    private convertTypeDocNode = (
        rootNode: TypeDocNode | undefined,
    ): string => {
        if (!rootNode) return '';
        switch (rootNode.kindString) {
            case TypeDocReflectionKind.Enumeration: {
                return this.handleMainNode(rootNode);
            }
            case TypeDocReflectionKind.Class: {
                return this.handleMainNode(rootNode);
            }
            case TypeDocReflectionKind.Interface: {
                return this.handleMainNode(rootNode);
            }
            case TypeDocReflectionKind.EnumerationMember: {
                return this.handleEnumMember(rootNode as EnumerationMemberNode);
            }
            case TypeDocReflectionKind.Constructor: {
                return this.handleFunctionNode(rootNode as FunctionNode);
            }
            case TypeDocReflectionKind.Method: {
                return this.handleFunctionNode(rootNode as FunctionNode);
            }
            case TypeDocReflectionKind.Function: {
                return this.handleFunctionNode(rootNode as FunctionNode);
            }
            case TypeDocReflectionKind.Parameter: {
                return this.handleParameterNode(rootNode as ParameterNode);
            }
            case TypeDocReflectionKind.Property: {
                return this.handlePropertyNode(rootNode as ParameterNode);
            }
            case TypeDocReflectionKind.TypeAlias: {
                return this.handleTypeAliasNode(rootNode as TypeAliasNode);
            }
            case TypeDocReflectionKind.TypeLiteral: {
                return this.handleTypeLiteralNode(rootNode as TypeLiteralNode);
            }
            case TypeDocReflectionKind.CallSignature: {
                return this.handleCallSignatureNode(rootNode as SignatureNode);
            }
            default: {
                console.error(
                    `No handler defined for : ${rootNode.kindString}, Name : ${rootNode.name}`,
                );
                return '';
            }
        }
    };

    public handleProjectNode = (
        node: TypeDocNode,
        indexPageId = 'VisualEmbedSdk',
        callBack: (pageId: string, content: string) => void,
    ) => {
        const projectNode = node;
        this.generateMap(projectNode);
        // creating an index page
        let indexPageContent = '= Visual Embed SDK\n\n';
        /* const indexPageHeading = '';
         */
        const indexPageHeading = this.getHeadingString({
            title: indexPageId,
            pageId: indexPageId,
            description: node?.comment?.shortText,
        });

        let sideNavContent = `* link:{{navprefix}}/${encodePageId(
            indexPageId,
        )}[Visual Embed SDK Reference]\n`;

        projectNode?.groups?.forEach((group) => {
            // create table group content
            let groupContent = `== ${group.title}\n\n[div boxDiv boxFullWidth]\n--\n`;
            groupContent += this.createTypeDocTable(
                group.children.map((id) =>
                    this.convertNodeToLink(this.childrenIdMap[id]),
                ),
                3,
            );
            groupContent += '--\n\n';

            const groupPageId = this.childrenIdMap[group.children[0]]
                .kindString;
            const groupHeading = this.getHeadingString({
                title: group.title,
                pageId: groupPageId,
                description: group.title,
            });

            sideNavContent += `** link:{{navprefix}}/${encodePageId(
                groupPageId,
            )}[${groupPageId}]\n`;

            group.children.forEach((id) => {
                const child = this.childrenIdMap[id];
                const pageId = `${child.kindString}_${child.name}`;
                const heading = this.getHeadingString({
                    title: child.name,
                    pageId,
                    description: child?.comment?.shortText,
                });

                sideNavContent += `*** link:{{navprefix}}/${encodePageId(
                    pageId,
                )}[${child.name}]\n`;

                const content = this.convertTypeDocNode(child);
                callBack(pageId, `${heading}\n\n${content}`);
            });

            callBack(groupPageId, `${groupHeading}\n\n${groupContent}`);

            indexPageContent += groupContent;
        });

        callBack('VisualEmbedSdkNavLinks', sideNavContent);

        callBack(indexPageId, `${indexPageHeading}\n\n${indexPageContent}`);
    };
}

class TypedocConverter {
    private typedDocParser = new TypeDocParser();

    constructor(branch: string) {
        TypeDocInternalParser.convertNameToLink = this.typedDocParser.convertNameToLink;
        TypeDocInternalParser.GITHUB_LINK = `https://github.com/thoughtspot/visual-embed-sdk/blob/${branch}/src`;

        console.info('Source link : ', TypeDocInternalParser.GITHUB_LINK);
    }

    private writeFile(filePath: string, content: string): void {
        const folderPath = path.dirname(filePath);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        console.info('File created : ', filePath);

        fs.writeFileSync(filePath, content);
    }

    public generateFiles = (typedocNode: TypeDocNode) => {
        // starting node should be a project node
        if (typedocNode.kindString !== TypeDocReflectionKind.Project) {
            return;
        }
        const indexPageId = 'VisualEmbedSdk';
        this.typedDocParser.handleProjectNode(
            typedocNode,
            indexPageId,
            (pageId, content) => {
                const updatedPageId = pageId.replace('_', '/');
                const filePath =
                    pageId === 'VisualEmbedSdkNavLinks'
                        ? `modules/ROOT/pages/common/generated/typedoc/${updatedPageId}.adoc`
                        : `modules/ROOT/pages/generated/typedoc/${updatedPageId}.adoc`;
                this.writeFile(filePath, content);
            },
        );
    };
}

const getFileFromUrl = async (url: string) => {
    console.log('Reading from remote');
    const data = await nodeFetch(url);
    return data.text();
};

const getFileFromLocal = async (filePath: string) => {
    console.log('Reading from local');
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    return fileContent;
};

const getFile = async (filePath: string) => {
    console.info(`Reading file from : ${filePath}`);
    if (filePath.startsWith('http://') || filePath.startsWith('https://'))
        return getFileFromUrl(filePath);
    return getFileFromLocal(filePath);
};

const main = async () => {
    const defaultCliOptions = {
        branch: 'main',
        typeDocFilePath:
            'https://raw.githubusercontent.com/thoughtspot/visual-embed-sdk/{branch}/static/typedoc/typedoc.json',
    };

    const cliKeys = Object.keys(defaultCliOptions).map((key) => ({
        cliPrefix: `--${key}=`,
        optionKey: key,
    }));
    const cliOptions = process.argv.reduce((acc, arg) => {
        const newAcc = acc;
        cliKeys.forEach((cliKey) => {
            if (arg.startsWith(cliKey.cliPrefix))
                newAcc[cliKey.optionKey] = arg.replace(cliKey.cliPrefix, '');
        });
        return newAcc;
    }, defaultCliOptions);

    cliOptions.typeDocFilePath = cliOptions.typeDocFilePath.replace(
        '{branch}',
        cliOptions.branch,
    );

    console.log('Script options : ', cliOptions);

    const typeDocJson = await getFile(cliOptions.typeDocFilePath);
    const typedoc = JSON.parse(typeDocJson);
    console.info(`Parse success : ${cliOptions.typeDocFilePath}`);

    const converter = new TypedocConverter(cliOptions.branch);

    converter.generateFiles(typedoc);
};

main();
