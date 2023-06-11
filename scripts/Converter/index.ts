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
    declaration?: TypeDocNode;
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

// All the parse functions are to be used internally (its used to get sub content)
// To get the main content use the handleNode function
class TypeDocParser {
    private covertTypeDocText = (text: string) => {
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
    private parseTag(tag: TypeDocCommentTag): string {
        if (tag.tag === 'group') return '';
        if (tag.tag === 'version')
            return `[version]#${tag.text.replace(/\n/g, '')}#\n`;
        return `\n\`${tag.tag}\` : ${tag.text}\n\n\n`;
    }

    private parseComment(comment: TypeDocComment | undefined): string {
        if (!comment) return '';

        let content = '';
        content += this.covertTypeDocText(
            `${comment?.shortText || ''}\n${comment?.text || ''}\n\n`,
        );

        // process tags
        const tags = comment?.tags;
        if (tags) {
            tags.forEach((tag) => {
                content += this.parseTag(tag);
            });
        }
        return content;
    }

    private parseSources = (sources: TypeDocSource[] | undefined) => {
        if (!sources) return '';
        const GITHUB_LINK =
            'https://github.com/thoughtspot/visual-embed-sdk/blob/main/src';
        return sources
            .map(
                (source) =>
                    `Defined in : link:${GITHUB_LINK}/${source.fileName}#L${source.line}[${source.fileName}, window=_blank]`,
            )
            .join('\n');
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

    private childrenIdMap: Record<number, TypeDocLinkingNode> = {};

    private childrenNameMap: Record<string, TypeDocLinkingNode> = {};

    private groupMap: Record<string, TypeDocLinkingNode[]> = {};

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

    // handles the Main page nodes (Enum, Class, Interface, Type Alias)
    public handleMainNode = (node: TypeDocNode) => {
        const pageTitle = `= ${node.name}`;

        let mainPageContent = '';

        if (node.kindString === 'Enumeration') {
            mainPageContent += '[cols="1,1,1,1,1"]\n|===\n';
            node.children?.forEach((e) => {
                mainPageContent += `| ${this.convertNodeToLink(e)}\n`;
            });
            mainPageContent += '| \n| \n| \n| \n';
            mainPageContent += '|===\n';
        }

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
            mainPageContent,
            this.parseComment(node.comment),
            groupContent,
        ].join('\n\n');
    };

    public handleEnumMember = (enumMember: EnumerationMemberNode) => {
        // debugger;
        const sourceContent = this.parseSources(enumMember.sources);
        return [
            `=== ${enumMember.name}`,
            `\`${enumMember.name}:= ${enumMember.defaultValue}\`\n`,
            this.parseComment(enumMember.comment),
            sourceContent,
        ].join('\n');
    };

    private convertNodeToLink = (node: TypeDocNode) => {
        const parent = this.childrenIdMap[node.id]?.parentId;
        if (parent === undefined) return node.name;

        if (
            this.childrenIdMap[parent]?.kindString ===
            TypeDocReflectionKind.Project
        ) {
            return `xref:${node.name}.adoc[${node.name}]`;
        }

        const grandParent = this.childrenIdMap[parent]?.parentId;
        if (grandParent === undefined) return node.name;

        if (
            this.childrenIdMap[grandParent]?.kindString ===
            TypeDocReflectionKind.Project
        ) {
            let newLinkText = `xref:${this.childrenIdMap[parent].name}.adoc`;
            newLinkText += `#_${node.name.toLowerCase()}`;
            newLinkText += `[${node.name}]`;
            return newLinkText;
        }

        return '';
    };

    private convertNameToLink = (linkTo: string | undefined) => {
        if (!linkTo) return '';

        const [name, hash] = linkTo.split('.');
        if (!name) return '';

        if (hash) {
            return `xref:${name}.adoc#_${hash.toLocaleLowerCase()}[${hash}]`;
        }

        return `xref:${name}.adoc[${name}]`;
    };

    // TODO : better handling for typeArg
    private parseTypeDocType = (
        node: TypeDocType | undefined,
        link = false,
    ): string => {
        let typeArg = '';
        if (!node) return '';

        if (node.typeArguments && node.typeArguments.length) {
            typeArg = `<${node.typeArguments
                ?.map((type) => this.parseTypeDocType(type, link))
                .join(', ')}>`;
        }

        switch (node.type) {
            case 'literal':
                return `"${node.value}"`;
            case 'intrinsic':
                return node.name + typeArg || '';
            case 'reference': {
                // since code block doesn't support links
                if (link) return this.convertNameToLink(node.name) + typeArg;
                return node.name + typeArg || '';
            }
            case 'union': {
                return (
                    node.types
                        ?.map((type) => this.parseTypeDocType(type))
                        .join(' | ') + typeArg || ''
                );
            }
            case 'reflection': {
                return this.convertTypeDocNode(node.declaration) + typeArg;
            }
            case 'array': {
                return `${this.parseTypeDocType(node.elementType) + typeArg}[]`;
            }
            default: {
                console.error(`${node.type} not handled`);
                return node.name || '';
            }
        }
    };

    // handles both call and constructor signature
    private parseCallSignature = (node: SignatureNode, link?: boolean) => {
        return `(${this.parseParameters(
            node.parameters,
        )}) : ${this.parseTypeDocType(node.type, link)}`;
    };

    private parseIndexSignatures = (node: SignatureNode, link?: boolean) => {
        return `[${this.parseParameters(
            node.parameters,
        )}] : ${this.parseTypeDocType(node.type, link)}`;
    };

    private parseParameters = (parameters: ParameterNode[] | undefined) => {
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
                )} ${defaultValue}`;
            })
            .join(', ');
    };

    public handleFunctionNode = (node: FunctionNode) => {
        const name = `=== ${node.name}`;

        let overwrites = '';
        if (node.overwrites) {
            overwrites = `\`Overrides ${this.parseTypeDocType(
                node.overwrites,
            )}\``;
        }

        let inheritedFrom = '';
        if (node.inheritedFrom) {
            inheritedFrom = `\`Inherited from  ${this.parseTypeDocType(
                node.inheritedFrom,
            )}\``;
        }

        const signatureContent = node.signatures.map((signature) => {
            const sigText = signature.name + this.parseCallSignature(signature);

            const detailedParamContent = signature.parameters
                ?.map(this.convertTypeDocNode)
                .filter((text) => text)
                .join('\n\n');

            return [
                '[source, js]\n----',
                sigText,
                '----',
                this.parseComment(signature.comment),
                detailedParamContent && '==== Parameters',
                detailedParamContent,
                '==== Returns',
                this.parseTypeDocType(signature.type, true),
            ].join('\n\n');
        });

        const sources = this.parseSources(node.sources);

        return [
            name,
            this.parseComment(node.comment),
            overwrites,
            inheritedFrom,
            sources,
            signatureContent,
        ].join('\n\n');
    };

    public handleParameterNode = (node: ParameterNode) => {
        return [
            `* ${node.name}: ${this.parseTypeDocType(node.type, true)}${
                node?.defaultValue ? ` = ${node.defaultValue}` : ''
            }`,
            this.parseComment(node.comment),
        ].join('\n\n');
    };

    public convertTypeDocNode = (rootNode: TypeDocNode | undefined): string => {
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
                return this.handleParameterNode(rootNode as ParameterNode);
            }
            case TypeDocReflectionKind.TypeAlias: {
                return this.handleTypeAliasNode(rootNode as TypeAliasNode);
            }
            case TypeDocReflectionKind.TypeLiteral: {
                return this.parseTypeLiteralNode(rootNode as TypeLiteralNode);
            }
            default: {
                console.error(
                    `No handler defined for : ${rootNode.kindString}, Name : ${rootNode.name}`,
                );
                return '';
            }
        }
    };

    private parseTypeLiteralNode = (node: TypeLiteralNode) => {
        // 3 types

        if (node.indexSignature) {
            return this.parseIndexSignatures(node.indexSignature);
        }
        if (node.signatures) {
            return node.signatures
                .map((sig) => this.parseCallSignature(sig))
                .join('\n\n');
        }
        if (node.children) {
            return `{${this.parseParameters(
                node.children as ParameterNode[],
            )}}`;
        }
        console.error(
            `No handler defined for : ${node.kindString}, Name : ${node.name}`,
        );
        return '';
    };

    private handleTypeLiteralNode = (node: TypeLiteralNode | undefined) => {
        if (!node) return '';

        let content = '';
        if (node.indexSignature?.parameters) {
            content += '== Parameters\n\n';
            node.indexSignature.parameters
                .map(this.convertTypeDocNode)
                .join('\n\n');
        }
        if (node.signatures) {
            content += '== Index Signature Parameters\n\n';
            content += node.signatures
                .map(
                    (sig) =>
                        `${this.parseCallSignature(
                            sig,
                        )}\n\n${sig.parameters
                            ?.map(this.convertTypeDocNode)
                            .join('\n\n')}`,
                )
                .join('\n\n');
        }
        if (node.children) {
            content += '== Parameters\n\n';
            content += node.children.map(this.convertTypeDocNode).join('\n\n');
        }

        return content;
    };

    public handleTypeAliasNode = (node: TypeAliasNode) => {
        return [
            `= ${node.name}`,
            `[source, js]\n----\n${node.name} : ${this.parseTypeDocType(
                node.type,
            )}\n----`,
            this.parseSources(node.sources),
            this.parseComment(node.comment),
            `${this.convertTypeDocNode(node.type.declaration)}`,
        ].join('\n\n');
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
        const indexPageHeading = this.getHeadingString({
            title: indexPageId,
            pageId: indexPageId,
            description: node?.comment?.shortText,
        });

        let sideNavContent = `* link:{{navprefix}}/${encodePageId(
            indexPageId,
        )}[Visual Embed SDK]\n`;

        projectNode?.groups?.forEach((group) => {
            let groupContent = `== ${group.title}\n\n[div boxDiv boxFullWidth]\n--\n[cols="1,1,1"]\n|===\n`;

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
                groupContent += `| ${this.convertNodeToLink(child)}\n`;
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

            groupContent += '| \n| \n|===\n--\n\n';

            callBack(groupPageId, `${groupHeading}\n\n${groupContent}`);

            indexPageContent += groupContent;
        });

        callBack('VisualEmbedSdkNavLinks', sideNavContent);

        callBack(indexPageId, `${indexPageHeading}\n\n${indexPageContent}`);
    };
}

class TypedocConverter {
    private typedDocParser = new TypeDocParser();

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

const fileLink =
    process.argv[2] ||
    'https://raw.githubusercontent.com/thoughtspot/visual-embed-sdk/main/static/typedoc/typedoc.json';

const getFileFromUrl = async (url: string) => {
    const data = await nodeFetch(url);
    return data.text();
};

const main = async () => {
    console.info(`Reading file from : ${fileLink}`);
    const typeDocJson = await getFileFromUrl(fileLink);
    const typedoc = JSON.parse(typeDocJson);

    console.info(`Parse success : ${fileLink}`);
    const converter = new TypedocConverter();
    converter.generateFiles(typedoc);
};

main();
