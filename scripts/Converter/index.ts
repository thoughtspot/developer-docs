const path = require('path');
const fs = require('fs');
const nodeFetch = require('node-fetch');

interface SdkReferenceConfig {
    groupOrder: string[];
    fallbackGroup: string;
    // Leave the deprecated top-level items out of the docs.
    excludeDeprecated: boolean;
    // Corrections to the wording of an SDK comment, until the comment itself is fixed.
    commentFixes: { node: string; reason: string; find: string; replace: string }[];
    // Enumerations whose deprecated members are left out as well (e.g. Action).
    excludeDeprecatedMembersOf: string[];
    kindFallbackGroups: Record<string, string>;
    groupOverrides: Record<string, string[]>;
    // The groups whose items follow the order of their list in groupOverrides.
    curatedOrder: string[];
    groupPatterns: { group: string; pattern: string }[];
    descriptions: Record<string, string>;
    landingPage: {
        description: string;
        intro: string[];
        groupDescriptions: Record<string, string>;
        typeDescriptions: Record<string, string>;
    };
    // Groups listed as a page, under a parent group, instead of in the menu.
    childGroups: Record<string, { parent: string; pageId: string }>;
    actionEmbedTypes: {
        sourcePage: string;
        // Embed types that a writer has confirmed for Actions not in the table yet.
        confirmed: Record<string, string[]>;
    };
}

// Internal report for the docs writers. It is outside the folders that Gatsby reads
// (src/page and modules/), so it can never be part of the site.
// It is local only (git ignored) and written only for this branch of the SDK.
const ACTION_REPORT_PATH = 'scripts/Converter/reports/action-embed-types.md';
const ACTION_REPORT_BRANCH = 'main';

const sdkReferenceConfig: SdkReferenceConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sdk-reference-config.json'), 'utf8'),
);

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
    indexSignature?: SignatureNode;
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
    static convertToItalic = (name: string | undefined) => (name ? `_${name}_` : '');

    static convertNameToLink: (node: string | undefined, includeParent?: boolean) => string;

    static GITHUB_LINK = 'https://github.com/thoughtspot/visual-embed-sdk/blob/main/src';

    // In AsciiDoc a list must be preceded by a blank line, otherwise its first item
    // runs on into the paragraph above it. SDK comments are written as Markdown,
    // where that is not needed, so add the blank line. Code blocks are left alone.
    static separateListsFromParagraphs = (text: string) => {
        const isBullet = (line: string) => /^\s*[-*]\s+\S/.test(line);
        let inCodeBlock = false;
        const lines = text.split('\n');
        const result: string[] = [];
        lines.forEach((line, index) => {
            if (line.trimStart().startsWith('```')) inCodeBlock = !inCodeBlock;
            const previous = lines[index - 1];
            if (
                !inCodeBlock &&
                index > 0 &&
                isBullet(line) &&
                previous.trim() &&
                !isBullet(previous) &&
                !previous.trimStart().startsWith('```')
            ) {
                result.push('');
            }
            result.push(line);
        });
        return result.join('\n');
    };

    // Resolves the target of a {@link Target} to an AsciiDoc link, relative to the page
    // being written. Set by TypedocConverter.
    static resolveLinkTarget: (
        target: string,
        label?: string,
    ) => string | undefined;

    // `bareLinks` leaves out the typedoc style around a link. It is needed inside
    // the #...# marks of the deprecated and version tags, which it would end early.
    static covertTypeDocText = (text: string, bareLinks = false) => {
        // 1) Convert Markdown links -> AsciiDoc links
        const updated = TypeDocInternalParser.separateListsFromParagraphs(
            text,
        ).replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            'link:$2[$1]',
        );

        // 2) {@link Target} and {@link Target text} (also {@linkcode}, {@linkplain}).
        // A target that is not documented, such as a type the SDK does not export, is
        // shown as plain code, never as the braces of the tag.
        return updated.replace(
            /\{@link(?:code|plain)?\s+([^\s}|]+)(?:[\s|]+([^}]*))?\}/g,
            (_match, target: string, label?: string) => {
                const shown = label?.trim();
                if (/^https?:\/\//.test(target)) {
                    return `link:${target}[${shown || target}]`;
                }
                const link = TypeDocInternalParser.resolveLinkTarget(target, shown);
                if (!link) return `\`${shown || target}\``;
                return bareLinks ? link.replace(/^\[[^\]]*\]#(.*)#$/, '$1') : link;
            },
        );
    };

    // Plain text of a comment, for the description in the page metadata and search
    // results, where no markup is shown.
    static plainText = (text: string | undefined) =>
        (text || '')
            .replace(
                /\{@link(?:code|plain)?\s+([^\s}|]+)(?:[\s|]+([^}]*))?\}/g,
                (_match, target: string, label?: string) =>
                    (label || target).trim(),
            )
            .replace(/\s+/g, ' ')
            .trim();

    // An @example is mostly code, which must stay as it is, but the SDK also writes prose
    // in it, after the code. Convert the prose (its {@link}s and lists), not the code.
    static convertOutsideCodeBlocks = (text: string) => {
        const parts: { code: boolean; lines: string[] }[] = [];
        let inCode = false;
        text.split('\n').forEach((line) => {
            const isFence = line.trimStart().startsWith('```');
            const code = inCode || isFence;
            if (isFence) inCode = !inCode;
            const last = parts[parts.length - 1];
            if (last && last.code === code) last.lines.push(line);
            else parts.push({ code, lines: [line] });
        });
        return parts
            .map(({ code, lines }) =>
                code
                    ? lines.join('\n')
                    : TypeDocInternalParser.covertTypeDocText(lines.join('\n')),
            )
            .join('\n');
    };

    // Repairs the tags of a comment that the SDK source wrote wrongly: a closing code
    // fence repeated after an example, and a @version line written after the example so
    // that it became part of the example text.
    static repairTags = (tags: TypeDocCommentTag[]): TypeDocCommentTag[] => {
        const repaired: TypeDocCommentTag[] = [];
        const extra: TypeDocCommentTag[] = [];
        tags.forEach((tag) => {
            if (tag.tag !== 'example') {
                repaired.push(tag);
                return;
            }
            let { text } = tag;
            const version = text.match(/^[ \t]*@version[ \t]+(.+)$/m);
            if (version) {
                text = text.replace(version[0], '');
                if (!tags.some((other) => other.tag === 'version')) {
                    extra.push({ tag: 'version', text: `${version[1].trim()}\n` });
                }
            }
            text = text.replace(/^(```)[ \t]*\n(?:[ \t]*\n)*```[ \t]*$/gm, '$1');
            const fences = text
                .split('\n')
                .filter((line) => line.trimStart().startsWith('```')).length;
            if (fences % 2) text = `${text.trimEnd()}\n\`\`\``;
            repaired.push({ ...tag, text });
        });
        return [...repaired, ...extra];
    };

    // function to parse a tag
    static parseTag(tag: TypeDocCommentTag): string {
        if (!tag.tag.trim() || !tag.text.trim()) {
            console.log('\t', 'Tag skipped ', JSON.stringify(tag));
            return '';
        }
        if (tag.tag === 'group') return '';
        if (tag.tag === 'version')
            return `[version]#*Version* : ${tag.text.replace(/\n/g, '')}#\n`;
        if (tag.tag === 'example') {
            return `${this.convertOutsideCodeBlocks(tag.text)}\n`;
        }

        if (tag.tag === 'param') {
            return `\nParameter::\n${this.covertTypeDocText(tag.text)}\n`;
        }
        if (tag.tag === 'deprecated') {
            return `[deprecated]#*Deprecated* : ${this.covertTypeDocText(
                tag.text.replace(/\s*\n\s*/g, ' ').trim(),
                true,
            )}#\n`;
        }
        if (tag.tag === 'tryItOut') {
            return `++++\n<a href="{{previewPrefix}}${tag.text}" id="preview-in-playground" target="_blank">Try it out</a>\n++++\n`;
        }

        return `\n\`${tag.tag}\` : ${this.covertTypeDocText(tag.text)} \n`;
    }

    static parseComment(comment: TypeDocComment | undefined): string {
        if (!comment) return '';

        let content = '';
        const shortText = comment?.shortText?.trim() || '';
        const text = comment?.text?.trim() || '';

        content += this.covertTypeDocText(
            `${shortText}\n\n${text}\n\n`,
        );
        return content;
    }

    // Where the Version and Deprecated blocks of an item go:
    //  - an item that is not deprecated has its Version block right under the signature,
    //    before the description;
    //  - a deprecated item has its description first, then the Deprecated block, then
    //    the Version block, and then the other tags (default value, examples).
    // The two are never in one row. Use parseTags(tags, false) for the other tags.
    private static metaBlocks(tags: TypeDocCommentTag[] | undefined) {
        const repaired = this.repairTags(tags || []);
        const render = (name: string) =>
            repaired
                .filter((tag) => tag.tag === name)
                .map((tag) => this.parseTag(tag).trim())
                .filter(Boolean);
        return {
            version: render('version'),
            deprecated: render('deprecated'),
        };
    }

    static metaBeforeDescription(tags: TypeDocCommentTag[] | undefined) {
        const { version, deprecated } = this.metaBlocks(tags);
        return deprecated.length ? '' : version.join('\n\n');
    }

    static metaAfterDescription(tags: TypeDocCommentTag[] | undefined) {
        const { version, deprecated } = this.metaBlocks(tags);
        return deprecated.length ? [...deprecated, ...version].join('\n\n') : '';
    }

    static parseTags(tags: TypeDocCommentTag[] | undefined, includeMeta = true) {
        // process tags
        let content = '';

        const addTagsToContent = (tagsToAdd: TypeDocCommentTag[]) => {
            tagsToAdd.forEach((tag) => {
                content += `\n${this.parseTag(tag)}\n\n`;
            });
        };

        if (tags) {
            const repairedTags = this.repairTags(tags);
            const versionTags = repairedTags.filter((tag) => tag.tag === 'version');
            const deprecatedTags = repairedTags.filter(
                (tag) => tag.tag === 'deprecated',
            );
            const restTags = repairedTags.filter(
                (tag) => tag.tag !== 'version' && tag.tag !== 'deprecated',
            );

            if (includeMeta) {
                addTagsToContent(versionTags);
                addTagsToContent(deprecatedTags);
            }
            addTagsToContent(restTags);
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
                if (link) return this.convertToItalic(node.value);
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

    // The top-level items by name, and the one whose page is being written.
    private topLevelByName: Record<string, TypeDocLinkingNode> = {};

    private currentTopNode?: TypeDocLinkingNode;

    private groupMap: Record<string, TypeDocLinkingNode[]> = {};

    private actionEmbedTypes: Record<string, string[]> = {};

    // The link for the Target of a {@link Target}: Item, Item.member, or just a member
    // name, which is looked for on the page being written first (so that a property
    // that refers to another property of the same interface finds it). Nothing when the
    // target is not documented.
    public resolveLinkTarget = (target: string, label?: string) => {
        const [name, member] = target.split(/[.#]/);
        const node = member
            ? this.topLevelByName[name]?.children?.find(
                  (child) => child.name === member,
              )
            : this.currentTopNode?.children?.find((child) => child.name === name) ||
              this.topLevelByName[name];
        if (!node) return undefined;
        const link = this.convertNodeToLink(node, Boolean(member));
        if (!link || link === node.name) return undefined;
        return label ? link.replace(/\[[^\]]*\]#$/, `[${label}]#`) : link;
    };

    public convertNameToLink = (
        linkTo: string | undefined,
        includeParent = false,
    ) => {
        if (!linkTo) return '';

        const [name, hash] = linkTo.split('.');

        const nameNode = this.childrenNameMap[name || ''];

        if (hash) {
            const hashNode = nameNode?.children?.filter(
                (node) => node.name === hash,
            )[0];

            if (hashNode)
                return this.convertNodeToLink(hashNode, includeParent);
        }

        if (nameNode) return this.convertNodeToLink(nameNode, includeParent);

        // could not be resolved, so passing back the name to be displayed.
        if (hash && includeParent) return `${name}.${hash}`;
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
                    return TypeDocInternalParser.convertToItalic(node.value);
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

    // An index of links as a list. The page styles lay it out in columns, so
    // long names wrap instead of overflowing the fixed-width cells of a table.
    // A long camelCase name gets a line break opportunity (<wbr>) at each word
    // boundary, so it wraps between words and never leaves the icon on a line of
    // its own. <wbr> adds no text, so copying and searching are not affected.
    private createTypeDocIndex = (items: string[]): string => {
        if (!items.length) return '';
        const breakable = (item: string) =>
            item.replace(/\[([^\]]+)\]#$/, (_match, name: string) => {
                const withBreaks = name
                    .replace(/([a-z0-9])(?=[A-Z])/g, '$1+++<wbr>+++')
                    .replace(/([A-Z])(?=[A-Z][a-z])/g, '$1+++<wbr>+++');
                return `[${withBreaks}]#`;
            });
        return `[.typedoc-index]\n${items
            .map((item) => `* ${breakable(item)}`)
            .join('\n')}\n`;
    };

    private addToGroup = (groupName: string, node: TypeDocLinkingNode) => {
        if (!this.groupMap[groupName]) this.groupMap[groupName] = [];
        this.groupMap[groupName].push(node);
    };

    private getGroupTag = (node: TypeDocLinkingNode) =>
        (
            node.comment?.tags?.filter((e) => e.tag === 'group')[0] ||
            node?.signatures?.[0].comment?.tags?.filter(
                (e) => e.tag === 'group',
            )[0]
        )?.text.trim();

    // Sidebar group for a top-level node. Precedence: the docs-side override,
    // then the SDK's @group tag, then a name pattern for ungrouped nodes, then
    // the fallback group, so every generated page is reachable from the nav.
    private resolveTopLevelGroup = (node: TypeDocLinkingNode): string => {
        const {
            groupOverrides,
            groupPatterns,
            fallbackGroup,
            kindFallbackGroups,
        } = sdkReferenceConfig;
        const override = Object.keys(groupOverrides).find((group) =>
            groupOverrides[group].includes(node.name),
        );
        if (override) return override;

        const tagGroup = this.getGroupTag(node);
        if (tagGroup) return tagGroup;

        const isTypeShape = [
            TypeDocReflectionKind.Interface,
            TypeDocReflectionKind.TypeAlias,
            TypeDocReflectionKind.Enumeration,
        ].includes(node.kindString);
        const patternGroup = isTypeShape
            ? groupPatterns.find(({ pattern }) =>
                  new RegExp(pattern).test(node.name),
              )?.group
            : undefined;
        return (
            patternGroup || kindFallbackGroups[node.kindString] || fallbackGroup
        );
    };

    // The SDK comment if it has one, else the docs-side description (if any).
    private getDescription = (node: TypeDocNode): string | undefined => {
        const hasSdkComment =
            node.comment?.shortText?.trim() || node.comment?.text?.trim();
        if (hasSdkComment) return undefined;
        return sdkReferenceConfig.descriptions[node.name];
    };

    private generateMap = (node: TypeDocLinkingNode) => {
        const isTopLevel =
            this.childrenIdMap[node.parentId as number]?.kindString ===
            TypeDocReflectionKind.Project;
        if (isTopLevel) {
            this.topLevelByName[node.name] = node;
            this.addToGroup(this.resolveTopLevelGroup(node), node);
        } else {
            const groupName = this.getGroupTag(node);
            if (groupName) this.addToGroup(groupName, node);
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

    public getTypeCSSClass = (node) => {
        return `typedoc-${node.kindString.replace(/ /g, '_')}`;
    };

    private convertToAdocSectionLink = (str: string) => {
        // special handling for -- in the name
        let convertedStr = `_${str.replace(/--/g, '')}`;

        // convert all - to _
        convertedStr = convertedStr.replace(/-/g, '_');

        // convert multiple _ to single _
        convertedStr = convertedStr.replace(/_+/g, '_');

        // remove all special characters
        convertedStr = convertedStr.replace(/[^a-zA-Z0-9_]/g, '');

        // convert all spaces to -
        convertedStr = convertedStr.replace(/ /g, '-');

        // convert all uppercase to lowercase
        convertedStr = convertedStr.toLowerCase();

        return convertedStr;
    };

    private convertNodeToLink = (node: TypeDocNode, includeParent = false) => {
        const parent = this.childrenIdMap[node.id]?.parentId;
        if (parent === undefined) return node.name;

        if (
            this.childrenIdMap[parent]?.kindString ===
            TypeDocReflectionKind.Project
        ) {
            return `[.typedoc-${node.kindString.replace(/ /g, '_')}]#xref:${this.fileKeyOf(
                node,
            )}.adoc[${node.name}]#`;
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
            )}]#xref:${this.fileKeyOf(this.childrenIdMap[parent])}.adoc`;
            newLinkText += `#${this.convertToAdocSectionLink(node.name)}`;
            const visibleName = includeParent
                ? `${this.childrenIdMap[parent].name}.${node.name}`
                : node.name;
            newLinkText += `[${visibleName}]#`;
            return newLinkText;
        }

        return '';
    };

    // "Indexable" section: e.g. `[key: string]: any`
    private handleIndexable = (node: TypeDocNode) => {
        const signature = node.indexSignature;
        if (!signature?.parameters?.length) return '';

        const params = signature.parameters
            .map((param) => `${param.name}: ${this.parseTypeDocType(param.type)}`)
            .join(', ');

        return `== Indexable\n\n[div boxDiv boxFullWidth]\n--\n\`[${params}]: ${this.parseTypeDocType(
            signature.type,
        )}\`\n--\n`;
    };

    private parseNodeComment = (node: TypeDocNode): string => {
        const description = this.getDescription(node);
        if (description) {
            return `${TypeDocInternalParser.covertTypeDocText(description)}\n\n`;
        }
        return TypeDocInternalParser.parseComment(node.comment);
    };

    // handles the Main page nodes (Enum, Class, Interface, Type Alias)
    private handleMainNode = (node: TypeDocNode) => {
        const pageTitle = `= ${node.name}`;

        const mainPageContent = '';
        // The Index section is only emitted when it has entries to show.
        // An empty block is dropped by Asciidoctor and breaks the markdown conversion.
        let indexSection = '';
        if (
            ['Enumeration', 'Class', 'Interface'].includes(node.kindString) &&
            node.children?.length
        ) {
            indexSection = `== Index\n\n${
                node.name === 'Action' ? `${this.buildEmbedTypeFilter()}\n\n` : ''
            }\n\n[div boxDiv boxFullWidth]\n--\n${this.createTypeDocIndex(
                node.children.map((childNode) =>
                    this.convertNodeToLink(childNode),
                ),
            )}\n--\n\n`;
        }

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
            TypeDocInternalParser.metaBeforeDescription(node.comment?.tags),
            this.parseNodeComment(node),
            TypeDocInternalParser.metaAfterDescription(node.comment?.tags),
            TypeDocInternalParser.parseTags(node.comment?.tags, false),
            this.handleIndexable(node),
            indexSection,
            mainPageContent,
            groupContent,
        ]
            .filter((section) => section !== '')
            .join('\n\n');
    };

    // The SDK does not record which embed types support each Action, so the
    // mapping is read from the "Required SDK library" column of the hand
    // written Action IDs page. Rows look like:
    //   |xref:Action.adoc#_share[`Action.Share`]| `LiveboardEmbed` + `AppEmbed` | label
    // A leading `a` (a|xref:...) marks an AsciiDoc-style cell and is also a row start.
    // Items that are left out of the docs: anything deprecated, and anything the
    // SDK marks @hidden or @internal (the typedoc normally drops those already).
    private isExcludedFromDocs = (node: TypeDocNode, includeDeprecated = true) =>
        [
            ...(node.comment?.tags || []),
            ...((node as FunctionNode).signatures?.[0]?.comment?.tags || []),
        ].some(
            (tag) =>
                ['hidden', 'internal'].includes(tag.tag) ||
                (includeDeprecated && tag.tag === 'deprecated'),
        );

    // Removes the excluded top-level items (see excludeDeprecated in the config), and
    // the deprecated members of the enumerations in excludeDeprecatedMembersOf,
    // before anything is built. They get no page, no nav entry or index entry, and
    // a reference to one renders as plain text, not as a broken link.
    // The top-level items that were left out of the docs, for the reference check.
    public excludedPageNames: string[] = [];

    private excludeDeprecatedNodes = (project: TypeDocNode) => {
        const removeFrom = (
            parent: TypeDocNode,
            excluded: TypeDocNode[],
            label: string,
        ) => {
            if (!excluded.length) return;
            const excludedIds = new Set(excluded.map((node) => node.id));
            // eslint-disable-next-line no-param-reassign
            parent.children = parent.children?.filter(
                (node) => !excludedIds.has(node.id),
            );
            parent.groups?.forEach((group) => {
                // eslint-disable-next-line no-param-reassign
                group.children = group.children.filter(
                    (id) => !excludedIds.has(id),
                );
            });
            // eslint-disable-next-line no-param-reassign
            parent.groups = parent.groups?.filter((group) => group.children.length);
            console.info(
                `Excluded ${excluded.length} ${label} : ${excluded
                    .map((node) => node.name)
                    .join(', ')}`,
            );
        };

        const excludedItems = (project.children || []).filter((node) =>
            this.isExcludedFromDocs(node, sdkReferenceConfig.excludeDeprecated),
        );
        this.excludedPageNames = excludedItems.map((node) => node.name);
        removeFrom(project, excludedItems, 'deprecated or hidden items');
        sdkReferenceConfig.excludeDeprecatedMembersOf.forEach((name) => {
            const parent = (project.children || []).find(
                (node) => node.name === name,
            );
            if (!parent) return;
            removeFrom(
                parent,
                (parent.children || []).filter((member) =>
                    this.isExcludedFromDocs(member),
                ),
                `deprecated or hidden members of ${name}`,
            );
        });
    };

    // Applies the corrections in commentFixes to the comments of top-level items. The
    // match ignores how the text is wrapped. A fix that no longer matches (the SDK
    // fixed its comment) is reported, so that it can be removed.
    private applyCommentFixes = (project: TypeDocNode) => {
        sdkReferenceConfig.commentFixes.forEach(({ node, find, replace }) => {
            const target = (project.children || []).find(
                (child) => child.name === node,
            );
            const pattern = new RegExp(
                find
                    .trim()
                    .split(/\s+/)
                    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('\\s+'),
            );
            let applied = false;
            (['shortText', 'text'] as const).forEach((field) => {
                const current = target?.comment?.[field];
                if (target?.comment && current && pattern.test(current)) {
                    target.comment[field] = current.replace(pattern, () => replace);
                    applied = true;
                }
            });
            if (!applied) {
                console.warn(
                    `Comment fix for ${node} no longer matches the SDK comment, so it can be removed from commentFixes in sdk-reference-config.json`,
                );
            }
        });
    };

    // Warns about top-level items that this converter has no page for, which
    // would otherwise be missing from the docs without any sign of it.
    private warnAboutUnsupportedNodes = (project: TypeDocNode) => {
        const supported: TypeDocReflectionKind[] = [
            TypeDocReflectionKind.Enumeration,
            TypeDocReflectionKind.Class,
            TypeDocReflectionKind.Interface,
            TypeDocReflectionKind.TypeAlias,
            TypeDocReflectionKind.Function,
        ];
        const unsupported = (project.children || []).filter(
            (node) => !supported.includes(node.kindString),
        );
        if (unsupported.length) {
            console.warn(
                `Not documented, no page for this kind of item : ${unsupported
                    .map((node) => `${node.name} (${node.kindString})`)
                    .join(', ')}`,
            );
        }
        console.info(
            `Documented ${(project.children || []).length - unsupported.length} items, ${
                unsupported.length
            } not supported`,
        );
    };

    private loadActionEmbedTypes = () => {
        const { sourcePage } = sdkReferenceConfig.actionEmbedTypes;
        this.actionEmbedTypes = {};
        if (!fs.existsSync(sourcePage)) {
            console.warn(`Action embed types skipped, not found : ${sourcePage}`);
            return;
        }
        const rows = fs
            .readFileSync(sourcePage, 'utf8')
            .split(/\n(?=a?\|xref:Action\.adoc)/)
            .slice(1);
        rows.forEach((row) => {
            const nameMatch = row.match(
                /^a?\|xref:Action\.adoc#_[a-z0-9]+\[`Action\.([A-Za-z0-9]+)`\]/,
            );
            if (!nameMatch) return;
            const libraryCell = row
                .slice(nameMatch[0].length)
                .split(/\n?\|/)[1];
            const embedTypes = (libraryCell?.match(/`[A-Za-z]+Embed`/g) || []).map(
                (embed) => embed.replace(/`/g, ''),
            );
            const known = this.actionEmbedTypes[nameMatch[1]] || [];
            this.actionEmbedTypes[nameMatch[1]] = [
                ...known,
                ...embedTypes.filter((embed) => !known.includes(embed)),
            ];
        });
        console.info(
            `Embed types found for ${
                Object.keys(this.actionEmbedTypes).length
            } actions`,
        );

        this.addConfirmedEmbedTypes(sourcePage);

        // A row for an Action that is not documented (excluded or removed) links to an
        // anchor that no longer exists on the Action page.
        const documented = new Set(
            (this.childrenNameMap.Action?.children || []).map((member) => member.name),
        );
        const staleRows = Object.keys(this.actionEmbedTypes).filter(
            (name) => !documented.has(name),
        );
        if (staleRows.length) {
            console.warn(
                `Action page : ${staleRows.length} rows in ${sourcePage} are for Actions that are not documented (excluded or removed), so their links are dead : ${staleRows.join(
                    ', ',
                )}`,
            );
        }

        // An Action ID that is not in the table has no "Supported in" line. It is
        // still on the Action page and in the Index, so it shows when no embed type
        // is selected ("All") and under "Other" in the filter. The writers get the list,
        // with a suggestion to check, in the report (see buildActionReport).
        this.uncategorizedActions = (
            this.childrenNameMap.Action?.children || []
        ).filter((member) => !this.actionEmbedTypes[member.name]?.length);
        if (this.uncategorizedActions.length) {
            console.warn(
                `Action page : ${this.uncategorizedActions.length} Action IDs have no embed type yet. They show under "All" and "Other" on the Action page. The list, with suggestions for a writer to check, is in ${ACTION_REPORT_PATH}`,
            );
        }
    };

    // The Actions with no embed type yet, in the order of the Action page.
    private uncategorizedActions: TypeDocNode[] = [];

    // An internal report for the writers: which Actions have no embed type yet, and a
    // suggestion for each to check. It is written outside the folders that the site
    // is built from, and nothing in it is used by the pages or the filter.
    public buildActionReport = (): string => {
        const { sourcePage } = sdkReferenceConfig.actionEmbedTypes;
        const sdkVersion = (member: TypeDocNode) =>
            member.comment?.tags
                ?.find((tag) => tag.tag === 'version')
                ?.text.match(/SDK:\s*([0-9.]+)/)?.[1] || '';
        const oneLine = (member: TypeDocNode) =>
            `${member.comment?.shortText || ''}`
                .replace(/\*\*|`/g, '')
                .replace(/\s+/g, ' ')
                // Backslashes first, then the pipes: escaping a pipe adds a backslash, and a
                // backslash already in the text would otherwise change what that means.
                .replace(/\\/g, '\\\\')
                .replace(/\|/g, '\\|')
                .trim();

        const rows = this.uncategorizedActions.map((member) => ({
            member,
            suggestion: this.suggestEmbedTypes(member),
        }));
        const withSuggestion = rows.filter((row) => row.suggestion);
        const jsonEntry = (name: string, embedTypes: string[]) =>
            `    "${name}": [${embedTypes.map((embed) => `"${embed}"`).join(', ')}]`;

        const table = rows
            .map(({ member, suggestion }) =>
                [
                    `\`${member.name}\``,
                    sdkVersion(member) || '-',
                    suggestion ? suggestion.embedTypes.join(' + ') : 'no suggestion',
                    suggestion ? suggestion.reason : '-',
                    oneLine(member) || '(no description)',
                ].join(' | '),
            )
            .map((row) => `| ${row} |`);

        const confirmed = Object.keys(sdkReferenceConfig.actionEmbedTypes.confirmed || {});
        const staleRows = Object.keys(this.actionEmbedTypes).filter(
            (name) => !(this.childrenNameMap.Action?.children || []).some((m) => m.name === name),
        );

        return [
            '# Actions with no embed type yet',
            `INTERNAL. For the docs writers. Generated locally by \`npm run generate-typedoc\` (scripts/Converter/index.ts) from the ${ACTION_REPORT_BRANCH} branch of the SDK. Do not edit it by hand and do not commit it: it is git ignored. It is not part of the site, and nothing in it is shown to readers.`,
            `${rows.length} Action IDs have no embed type. They show under "All" and under "Other" in the filter on the Action page, with no "Supported in" line. ${withSuggestion.length} have a suggestion below. A suggestion is inferred from the description only, so check it (the SDK pull request that added the Action can help) before you use it.`,
            '## How to categorize an Action',
            [
                `1. Add a row for it to \`${sourcePage}\`, in the section it belongs to, with its embed types in the "Required SDK library" column. This is the full reference entry.`,
                '2. Or, to categorize it before that row is written, add its name and embed types under `actionEmbedTypes.confirmed` in `scripts/Converter/sdk-reference-config.json`. Remove the entry once the row is on the page; the row wins if both exist.',
                'On the next `npm run generate-typedoc` the Action gets its "Supported in" line and moves out of "Other" into its embed types.',
            ].join('\n'),
            '## Actions to categorize',
            [
                '| Action | Since SDK | Suggested embed types | Why | Description |',
                '| --- | --- | --- | --- | --- |',
                ...table,
            ].join('\n'),
            '## Suggestions as config entries',
            withSuggestion.length
                ? `NOT confirmed. Check each one, delete the ones that are wrong, then paste the rest into \`actionEmbedTypes.confirmed\`:\n\n\`\`\`json\n${withSuggestion
                      .map(({ member, suggestion }) =>
                          jsonEntry(member.name, suggestion?.embedTypes || []),
                      )
                      .join(',\n')}\n\`\`\``
                : 'None.',
            '## To tidy up',
            [
                `- Entries under \`actionEmbedTypes.confirmed\` in the config: ${
                    confirmed.length ? confirmed.join(', ') : 'none'
                }.`,
                `- Rows in \`${sourcePage}\` for Actions that are not documented (excluded or removed), whose links are dead: ${
                    staleRows.length ? staleRows.join(', ') : 'none'
                }.`,
            ].join('\n'),
        ].join('\n\n') + '\n';
    };

    // Embed types that a writer confirmed in the config, for Actions that are not in the
    // table yet. The table wins when an Action is in both, and a mistake in an entry
    // (a name that does not exist) is reported, not silently ignored.
    private addConfirmedEmbedTypes = (sourcePage: string) => {
        const confirmed = sdkReferenceConfig.actionEmbedTypes.confirmed || {};
        const documented = new Set(
            (this.childrenNameMap.Action?.children || []).map((member) => member.name),
        );
        Object.entries(confirmed).forEach(([name, embedTypes]) => {
            const unknownEmbeds = embedTypes.filter(
                (embed) =>
                    this.childrenNameMap[embed]?.kindString !==
                    TypeDocReflectionKind.Class,
            );
            if (!documented.has(name)) {
                console.warn(
                    `Action page : confirmed embed types for ${name} are ignored, there is no such documented Action`,
                );
            } else if (unknownEmbeds.length) {
                console.warn(
                    `Action page : confirmed embed types for ${name} are ignored, not embed classes : ${unknownEmbeds.join(
                        ', ',
                    )}`,
                );
            } else if (this.actionEmbedTypes[name]?.length) {
                console.warn(
                    `Action page : ${name} is in ${sourcePage} as well, so the confirmed entry in the config is not needed and can be removed`,
                );
            } else {
                this.actionEmbedTypes[name] = this.sortEmbedTypes(embedTypes);
            }
        });
    };

    // A cautious guess at the embed types of an Action from its description. It only
    // answers when the description is unambiguous, and returns nothing otherwise. It
    // is a hint for the writers: it is never put on a page or used by the filter.
    private suggestEmbedTypes = (
        member: TypeDocNode,
    ): { embedTypes: string[]; reason: string } | undefined => {
        const description = `${member.comment?.shortText || ''} ${
            member.comment?.text || ''
        }`.replace(/\s+/g, ' ');
        const lower = description.toLowerCase();

        const named = [
            ...new Set(
                description.match(
                    /\b(?:App|Liveboard|Search|SearchBar|Spotter|SpotterAgent)Embed\b/g,
                ),
            ),
        ];
        if (named.length) {
            return {
                embedTypes: this.sortEmbedTypes(named),
                reason: 'the description names the embed type',
            };
        }

        // Pages that only the full application has
        if (
            /homepage|home page|liveboard schedules|liveboards page|schedules page/.test(
                lower,
            )
        ) {
            return {
                embedTypes: ['AppEmbed'],
                reason: 'the description is about a page of the full application',
            };
        }
        const mentions = (word: string) => new RegExp(`\\b${word}`).test(lower);
        const others = (...words: string[]) => words.some(mentions);
        if (mentions('liveboard') && !others('answer', 'search', 'spotter')) {
            return {
                embedTypes: ['AppEmbed', 'LiveboardEmbed'],
                reason: 'the description mentions only Liveboard',
            };
        }
        if (mentions('spotter') && !others('liveboard', 'answer', 'search')) {
            return {
                embedTypes: ['AppEmbed', 'SpotterEmbed'],
                reason: 'the description mentions only Spotter',
            };
        }
        return undefined;
    };

    private embedTypeLink = (embedType: string) => {
        const embedNode = this.childrenNameMap[embedType];
        return embedNode ? this.convertNodeToLink(embedNode) : embedType;
    };

    private handleEnumMember = (enumMember: EnumerationMemberNode) => {
        // debugger;
        const sourceContent = TypeDocInternalParser.parseSources(
            enumMember.sources,
        );
        const parentName = this.childrenIdMap[
            (this.childrenIdMap[enumMember.id] as TypeDocLinkingNode)
                ?.parentId as number
        ]?.name;
        const embedTypes =
            parentName === 'Action'
                ? this.actionEmbedTypes[enumMember.name]
                : undefined;
        const supportedIn = embedTypes?.length
            ? `[.supported-in]\n**Supported in:** ${embedTypes
                  .map(this.embedTypeLink)
                  .join(', ')}\n`
            : '';
        return [
            `=== ${enumMember.name}`,
            '[div typeDocBlock boxFullWidth]\n--',
            `\`${enumMember.name}:= ${enumMember.defaultValue}\`\n`,
            TypeDocInternalParser.metaBeforeDescription(enumMember.comment?.tags),
            TypeDocInternalParser.parseComment(enumMember.comment),
            TypeDocInternalParser.metaAfterDescription(enumMember.comment?.tags),
            supportedIn,
            sourceContent,
            TypeDocInternalParser.parseTags(enumMember.comment?.tags, false),
            '--',
        ].join('\n');
    };

    private handleFunctionNode = (node: FunctionNode) => {
        const name = `=== ${node.name}`;

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
            TypeDocInternalParser.metaBeforeDescription(node.comment?.tags),
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.metaAfterDescription(node.comment?.tags),
            '[div typeDocBlock boxFullWidth]\n--',
            signatureContent,
            sources,
            overwrites,
            inheritedFrom,
            TypeDocInternalParser.parseTags(node.comment?.tags, false),
            '--',
        ].join('\n\n');
    };

    private handleParameterNode = (node: ParameterNode) => {
        return [
            `${node.name}::: ${node.flags.isOptional ? '_Optional_\n' : ''}`,
            `* ${node.name}: ${this.parseTypeDocType(node.type, true)}${
                node?.defaultValue ? ` = ${node.defaultValue}` : ''
            }`,
            TypeDocInternalParser.metaBeforeDescription(node.comment?.tags),
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.metaAfterDescription(node.comment?.tags),
            this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags, false),
        ].join('\n\n');
    };

    private handlePropertyNode = (node: ParameterNode) => {
        const sig = `\`${node.name}: ${this.parseTypeDocType(node.type, true)}${
            node?.defaultValue ? ` = ${node.defaultValue}` : ''
        }\``;

        return [
            `=== ${node.name}`,
            '[div typeDocBlock boxFullWidth]\n--',
            // Optional is on the same line as the signature
            // A role, not _underscores_: a link target in the signature can contain an underscore
            // (an enumeration member such as SPOTTER_2026_11), which AsciiDoc would pair
            // with the closing underscore of _Optional_ and turn into broken italics.
            node.flags.isOptional ? `${sig}  [.typedoc-optional]#Optional#` : sig,
            TypeDocInternalParser.metaBeforeDescription(node.comment?.tags),
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.metaAfterDescription(node.comment?.tags),
            this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags, false),
            '--\n',
        ].join('\n\n');
    };

    private handleCallSignatureNode = (node: SignatureNode) => {
        const parmContent = node.parameters
            ?.map(this.convertTypeDocNode)
            .join('\n\n');

        return [
            TypeDocInternalParser.metaBeforeDescription(node.comment?.tags),
            TypeDocInternalParser.parseComment(node.comment),
            TypeDocInternalParser.metaAfterDescription(node.comment?.tags),
            node.parameters?.length ? '**Function Parameters**' : '',
            parmContent,
            '**Returns**',
            TypeDocInternalParser.parseTypeDocType(node.type, true),
            // SCAL-182339
            // this.handleTypeNode(node.type),
            TypeDocInternalParser.parseTags(node.comment?.tags, false),
        ].join('\n\n');
    };

    private handleCallSignatureNodes = (nodes: SignatureNode[]) => {
        let content = '';
        content += nodes
            .map((node) => {
                return [
                    `\`${node.name}${TypeDocInternalParser.parseCallSignature(
                        node,
                        false,
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
            content += node.indexSignature.parameters
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
            content += node.children
                .map((child) =>
                    this.handleParameterNode(child as ParameterNode),
                )
                .join('\n\n');
        }

        return content;
    };

    private handleTypeNode = (node: TypeDocType | undefined) => {
        const content = [
            TypeDocInternalParser.metaBeforeDescription(
                node?.declaration?.comment?.tags,
            ),
            TypeDocInternalParser.parseComment(node?.declaration?.comment),
            TypeDocInternalParser.metaAfterDescription(
                node?.declaration?.comment?.tags,
            ),
            TypeDocInternalParser.parseTags(node?.declaration?.comment?.tags, false),
            this.handleTypeLiteralNode(node?.declaration),
        ].join('\n\n');

        return content;
    };

    private handleTypeAliasNode = (node: TypeAliasNode) => {
        return [
            `= ${node.name}`,
            `\`${node.name} : ${this.parseTypeDocType(node.type, true)}\``,
            this.parseNodeComment(node),
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

    // The name of the file and the page of an item. It is the name of the item, except on a
    // case-insensitive file system (macOS, Windows), where two items of one kind whose
    // names differ only by letter case would overwrite each other. The later one then gets
    // a suffix, here and in every link to it, so that its page is not lost.
    private fileKeys: Record<number, string> = {};

    private fileKeyOf = (node: TypeDocNode) => this.fileKeys[node.id] || node.name;

    private assignFileKeys = (project: TypeDocNode, caseInsensitive: boolean) => {
        this.fileKeys = {};
        const byLowerCase: Record<string, TypeDocNode[]> = {};
        (project.children || []).forEach((node) => {
            const key = `${node.kindString}/${node.name.toLowerCase()}`;
            byLowerCase[key] = [...(byLowerCase[key] || []), node];
        });
        const collisions = Object.values(byLowerCase).filter(
            (nodes) => nodes.length > 1,
        );
        collisions.forEach((nodes) => {
            [...nodes]
                .sort((a, b) => (a.name < b.name ? -1 : 1))
                .slice(1)
                .forEach((node, index) => {
                    if (caseInsensitive) {
                        this.fileKeys[node.id] = `${node.name}-${index + 2}`;
                    }
                });
        });
        if (!collisions.length) return;
        const pairs = collisions
            .map((nodes) => nodes.map((node) => node.name).join(' and '))
            .join(', ');
        console.warn(
            caseInsensitive
                ? `File names that differ only by letter case (${pairs}). This file system is case-insensitive, so the later one of each pair is written under a name with a suffix, here and in its links. A Linux build writes each under its own name. The SDK should rename one of them.`
                : `Names that differ only by letter case (${pairs}). They are separate files here, but on macOS and Windows they would overwrite each other. The SDK should rename one of them.`,
        );
    };

    private getPageId = (node: TypeDocNode) => {
        return encodePageId(`${node.kindString}_${this.fileKeyOf(node)}`);
    };

    public handleProjectNode = (
        node: TypeDocNode,
        indexPageId = 'VisualEmbedSdk',
        callBack: (pageId: string, content: string) => void,
        options: { caseInsensitiveFileSystem?: boolean } = {},
    ) => {
        const projectNode = node;
        this.excludeDeprecatedNodes(projectNode);
        this.applyCommentFixes(projectNode);
        this.warnAboutUnsupportedNodes(projectNode);
        this.generateMap(projectNode);
        this.assignFileKeys(projectNode, Boolean(options.caseInsensitiveFileSystem));
        this.loadActionEmbedTypes();
        // Pages that list every item of one kind (Enumeration, Class, ...),
        // linked from the landing page.
        const typePages: { title: string; pageId: string }[] = [];
        const indexPageHeading = this.getHeadingString({
            title: indexPageId,
            pageId: indexPageId,
            description: TypeDocInternalParser.plainText(
                node?.comment?.shortText ||
                    sdkReferenceConfig.landingPage.description,
            ),
        });

        let sideNavContent = `* link:{{navprefix}}/${encodePageId(
            indexPageId,
        )}[Visual Embed SDK Reference]\n`;

        projectNode?.groups?.forEach((group) => {
            // create index group content
            const typeDescription =
                sdkReferenceConfig.landingPage.typeDescriptions[group.title];
            if (!typeDescription) {
                console.warn(
                    `Type page : no description in sdk-reference-config.json for ${group.title}`,
                );
            }
            let groupContent = `== ${group.title}\n\n${
                typeDescription ? `${typeDescription}\n\n` : ''
            }[div boxDiv boxFullWidth]\n--\n`;
            groupContent += this.createTypeDocIndex(
                group.children.map((id) =>
                    this.convertNodeToLink(this.childrenIdMap[id]),
                ),
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
                const pageId = `${child.kindString}_${this.fileKeyOf(child)}`;
                const heading = this.getHeadingString({
                    title: child.name,
                    pageId,
                    description: TypeDocInternalParser.plainText(
                        child?.comment?.shortText || this.getDescription(child),
                    ),
                });

                sideNavContent += `*** link:{{navprefix}}/${encodePageId(
                    pageId,
                )}[${child.name}]\n`;

                this.currentTopNode = child;
                const content = this.convertTypeDocNode(child);
                callBack(pageId, `${heading}\n\n${content}`);
            });

            callBack(groupPageId, `${groupHeading}\n\n${groupContent}`);
            typePages.push({ title: group.title, pageId: groupPageId });
        });

        callBack('VisualEmbedSdkNavLinks', sideNavContent);

        callBack(
            indexPageId,
            `${indexPageHeading}\n\n${this.buildLandingPage(typePages)}`,
        );

        Object.entries(sdkReferenceConfig.childGroups).forEach(
            ([group, { pageId }]) => {
                const content = this.buildChildGroupPage(group, pageId);
                if (content) callBack(pageId, content);
            },
        );

        // Included under a "Visual Embed SDK Reference" entry by both
        // nav-sdk-reference.adoc and the merged in-product nav.
        callBack('SdkReferenceNav', this.buildSdkReferenceNav(typePages));
    };

    // Landing page: an intro, then one section per sidebar category with its
    // description and an index of its items. The text is kept in
    // sdk-reference-config.json, not in the generated file, so it is still
    // there after every regeneration. A category with no text still gets its
    // heading and index, so a group added to the SDK shows up on its own.
    private buildLandingPage = (
        typePages: { title: string; pageId: string }[],
    ): string => {
        const { intro, groupDescriptions } = sdkReferenceConfig.landingPage;
        const groups = this.getOrderedGroupNames();

        const withoutText = groups.filter((group) => !groupDescriptions[group]);
        if (withoutText.length) {
            console.warn(
                `Landing page : no description in sdk-reference-config.json for ${withoutText.join(
                    ', ',
                )}`,
            );
        }
        const unused = Object.keys(groupDescriptions).filter(
            (group) =>
                !groups.includes(group) &&
                group !== sdkReferenceConfig.fallbackGroup,
        );
        if (unused.length) {
            console.warn(
                `Landing page : description for a category that no longer exists : ${unused.join(
                    ', ',
                )}`,
            );
        }

        const browseByType = typePages
            .map(
                ({ title, pageId }) =>
                    `link:{{navprefix}}/${encodePageId(pageId)}[${title}]`,
            )
            .join(', ');

        const sections = groups.map((group) =>
            [
                `== ${group}`,
                groupDescriptions[group] || '',
                `[div boxDiv boxFullWidth]\n--\n${this.createTypeDocIndex(
                    this.getGroupItems(group).map((groupNode) =>
                        this.convertNodeToLink(groupNode),
                    ),
                )}--`,
            ].join('\n\n'),
        );

        return [
            '= Visual Embed SDK',
            ...intro,
            `To list every item of one kind, browse by type: ${browseByType}.`,
            ...sections,
        ].join('\n\n');
    };

    // The items of a group. A group in curatedOrder follows the order of its list in
    // groupOverrides, so the embed class and its view config come first. An item that
    // the SDK adds to such a group and that is not in the list yet comes after the listed
    // ones, in SDK order, and is reported so that it gets added to the list. Any other
    // group keeps the order of the SDK, enumerations first.
    private getGroupItems = (group: string): TypeDocLinkingNode[] => {
        const items = this.groupMap[group] || [];
        const listed = sdkReferenceConfig.groupOverrides[group];
        if (!listed || !sdkReferenceConfig.curatedOrder.includes(group)) return items;

        const inList = items
            .filter((item) => listed.includes(item.name))
            .sort((a, b) => listed.indexOf(a.name) - listed.indexOf(b.name));
        const notInList = items.filter((item) => !listed.includes(item.name));
        if (notInList.length && !this.reportedUnlistedGroups.has(group)) {
            this.reportedUnlistedGroups.add(group);
            console.warn(
                `Category ${group} : ${notInList.length} items are not in its list in groupOverrides in sdk-reference-config.json, so they come after the listed ones, in SDK order. Add them to the list to place them : ${notInList
                    .map((item) => item.name)
                    .join(', ')}`,
            );
        }
        return [...inList, ...notInList];
    };

    private reportedUnlistedGroups = new Set<string>();

    // Groups in the order set in the config, then any other group A-Z.
    private getOrderedGroupNames = () => {
        const { groupOrder } = sdkReferenceConfig;
        const rank = (group: string) => {
            const index = groupOrder.indexOf(group);
            return index === -1 ? groupOrder.length : index;
        };
        return Object.keys(this.groupMap).sort(
            (a, b) => rank(a) - rank(b) || a.localeCompare(b),
        );
    };

    // A child group (see childGroups in the config) appears as one entry under its
    // parent group, linking to a page that lists its items. Its items are still in
    // the nav, in a list that the sidebar does not show (`nav-hidden-children`), so
    // their pages keep the right sidebar and breadcrumbs.
    private getChildGroups = (parent: string) =>
        Object.entries(sdkReferenceConfig.childGroups)
            .filter(
                ([group, config]) =>
                    config.parent === parent &&
                    this.groupMap[group] &&
                    this.groupMap[config.parent],
            )
            .map(([group, config]) => ({ group, pageId: config.pageId }));

    private isNestedChildGroup = (group: string) => {
        const config = sdkReferenceConfig.childGroups[group];
        return Boolean(config && this.groupMap[config.parent]);
    };

    private buildNavItem = (toLinkNode: TypeDocLinkingNode, bullet: string) =>
        `${bullet} [.${this.getTypeCSSClass(
            toLinkNode,
        )}]#link:{{navprefix}}/${this.getPageId(toLinkNode)}[${
            toLinkNode.name
        }]#\n`;

    private buildSdkReferenceNav = (
        typePages: { title: string; pageId: string }[],
    ) => {
        const groupBullet = '**';
        const itemBullet = '***';
        const subItemBullet = '****';

        let content = '';
        this.getOrderedGroupNames()
            .filter((group) => !this.isNestedChildGroup(group))
            .forEach((group) => {
                content += `${groupBullet} ${group}\n`;

                this.getGroupItems(group).forEach((toLinkNode) => {
                    content += this.buildNavItem(toLinkNode, itemBullet);
                });

                this.getChildGroups(group).forEach((child) => {
                    content += `${itemBullet} link:{{navprefix}}/${child.pageId}[${child.group}]\n`;
                    content += '[.nav-hidden-children]\n';
                    this.getGroupItems(child.group).forEach((toLinkNode) => {
                        content += this.buildNavItem(toLinkNode, subItemBullet);
                    });
                });

                content += '\n';
            });

        // The pages that list every item of one kind. They are plain links: the
        // items themselves are already in the categories above.
        if (typePages.length) {
            content += `${groupBullet} Browse by type\n`;
            typePages.forEach(({ title, pageId }) => {
                content += `${itemBullet} link:{{navprefix}}/${encodePageId(
                    pageId,
                )}[${title}]\n`;
            });
            content += '\n';
        }

        return content;
    };

    // The page of a child group: its description and an index of its items.
    private buildChildGroupPage = (group: string, pageId: string): string => {
        if (!this.groupMap[group]) return '';
        const description =
            sdkReferenceConfig.landingPage.groupDescriptions[group] || '';
        const heading = this.getHeadingString({
            toc: false,
            title: group,
            pageId,
            description: TypeDocInternalParser.plainText(
                description.replace(/`/g, ''),
            ),
        });
        return [
            heading,
            `= ${group}`,
            description,
            `[div boxDiv boxFullWidth]\n--\n${this.createTypeDocIndex(
                this.getGroupItems(group).map((groupNode) =>
                    this.convertNodeToLink(groupNode),
                ),
            )}--`,
        ].join('\n\n');
    };

    private sortEmbedTypes = (embedTypes: string[]) => {
        const preferredOrder = [
            'AppEmbed',
            'LiveboardEmbed',
            'SearchEmbed',
            'SearchBarEmbed',
            'SpotterEmbed',
        ];
        const rank = (embed: string) => {
            const index = preferredOrder.indexOf(embed);
            return index === -1 ? preferredOrder.length : index;
        };
        return [...embedTypes].sort(
            (a, b) => rank(a) - rank(b) || a.localeCompare(b),
        );
    };

    // Placeholder that the Document component swaps for the EmbedTypeFilter
    // component, which filters the Action sections by their "Supported in" line.
    private buildEmbedTypeFilter = (): string => {
        const embedTypes = this.sortEmbedTypes([
            ...new Set(Object.values(this.actionEmbedTypes).flat()),
        ]);
        if (!embedTypes.length) return '';
        return `++++\n<div class="embed-type-filter" data-embed-types="${embedTypes.join(
            ',',
        )}"></div>\n++++\n`;
    };

}

// Whether the file system treats File and file as one name, as macOS and Windows do by
// default. Checked by writing a file and looking for it under another case.
const isCaseInsensitiveFileSystem = (dir: string) => {
    const probe = path.join(dir, `.case-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    try {
        return fs.existsSync(path.join(dir, `.CASE-PROBE-${process.pid}`));
    } finally {
        fs.unlinkSync(probe);
    }
};

// The id that Asciidoctor gives a heading, which is what an xref#anchor has to match:
// lower case, other characters dropped, spaces and hyphens become underscores.
const asciidoctorId = (heading: string) =>
    `_${heading
        .toLowerCase()
        .replace(/[^a-z0-9 _.-]+/g, '')
        .replace(/[ .-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/_$/, '')}`;

class TypedocConverter {
    private typedDocParser = new TypeDocParser();

    // The SDK branch that the typedoc is read from.
    private branch: string;

    constructor(branch: string) {
        this.branch = branch;
        TypeDocInternalParser.convertNameToLink = this.typedDocParser.convertNameToLink;
        TypeDocInternalParser.resolveLinkTarget = this.typedDocParser.resolveLinkTarget;
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

    // A hand-written page that links to a generated page, or to an anchor on it, that is not
    // there any more (an item or member that was excluded or removed) has a dead link. Say
    // so, for every hand-written page in modules/, not only the Action IDs page.
    private warnAboutDeadReferences = (
        files: { filePath: string; content: string }[],
    ) => {
        const anchorsOfPage: Record<string, Set<string>> = {};
        files.forEach(({ filePath, content }) => {
            anchorsOfPage[path.basename(filePath, '.adoc')] = new Set(
                [...content.matchAll(/^={2,6} (.+)$/gm)].map((match) =>
                    asciidoctorId(match[1].trim()),
                ),
            );
        });
        const excluded = new Set(this.typedDocParser.excludedPageNames);

        const dead: string[] = [];
        const visit = (dir: string) => {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'generated' && entry.name !== 'node_modules') {
                        visit(full);
                    }
                    return;
                }
                if (!entry.name.endsWith('.adoc')) return;
                fs.readFileSync(full, 'utf8')
                    .split('\n')
                    .forEach((line, index) => {
                        [...line.matchAll(/xref:([^\s#[\]]+)\.adoc(?:#([^\s[]+))?/g)].forEach(
                            ([, page, anchor]) => {
                                const where = `${full}:${index + 1}`;
                                if (anchorsOfPage[page]) {
                                    if (anchor && !anchorsOfPage[page].has(anchor)) {
                                        dead.push(`${where} ${page}.adoc#${anchor}`);
                                    }
                                } else if (excluded.has(page)) {
                                    dead.push(`${where} ${page}.adoc (excluded from the docs)`);
                                }
                            },
                        );
                    });
            });
        };
        visit('modules');

        if (dead.length) {
            console.warn(
                `Hand-written pages link to generated pages or anchors that do not exist (an item or member was excluded or removed). Update or remove these links :\n${dead
                    .map((entry) => `    ${entry}`)
                    .join('\n')}`,
            );
        }
    };

    public generateFiles = (typedocNode: TypeDocNode) => {
        // starting node should be a project node
        if (typedocNode.kindString !== TypeDocReflectionKind.Project) {
            return;
        }
        const indexPageId = 'VisualEmbedSdk';
        const pagesDir = 'modules/ROOT/pages/generated/typedoc';
        const navDir = 'modules/ROOT/pages/common/generated/typedoc';
        const navPageIds = ['VisualEmbedSdkNavLinks', 'SdkReferenceNav'];

        // Build every file first, so that a failure part way leaves the previous
        // output in place instead of a half written one.
        const caseInsensitiveFileSystem = isCaseInsensitiveFileSystem(
            'modules/ROOT/pages',
        );
        const files: { filePath: string; content: string }[] = [];
        this.typedDocParser.handleProjectNode(
            typedocNode,
            indexPageId,
            (pageId, content) => {
                const updatedPageId = pageId.replace('_', '/');
                files.push({
                    filePath: `${
                        navPageIds.includes(pageId) ? navDir : pagesDir
                    }/${updatedPageId}.adoc`,
                    content,
                });
            },
            { caseInsensitiveFileSystem },
        );

        // On a case-insensitive file system the parser has already given the later one of two
        // names that differ only by letter case a suffix. If two files would still be one, stop:
        // writing them would silently lose a page.
        if (caseInsensitiveFileSystem) {
            const seen: Record<string, string> = {};
            files.forEach(({ filePath }) => {
                const key = filePath.toLowerCase();
                if (seen[key] && seen[key] !== filePath) {
                    throw new Error(
                        `${seen[key]} and ${filePath} are one file on this file system, so one page would be lost`,
                    );
                }
                seen[key] = filePath;
            });
        }

        this.warnAboutDeadReferences(files);

        // Both folders hold only generated files (they are git ignored). Clear
        // them so that a page for an item that was removed, or excluded, from
        // the SDK docs does not stay behind from an earlier run.
        [pagesDir, navDir].forEach((dir) =>
            fs.rmSync(dir, { recursive: true, force: true }),
        );
        files.forEach(({ filePath, content }) =>
            this.writeFile(filePath, content),
        );

        // The report for the writers is local only (the folder is git ignored) and it is
        // written only for the main branch of the SDK. Another branch has other
        // Actions, and its list would only get in the way of the one for main.
        if (this.branch === ACTION_REPORT_BRANCH) {
            this.writeFile(
                ACTION_REPORT_PATH,
                this.typedDocParser.buildActionReport(),
            );
        } else {
            console.info(
                `Action report skipped : it is written only for the ${ACTION_REPORT_BRANCH} branch of the SDK, this run reads ${this.branch}`,
            );
        }
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
    let cliOptions = process.argv.reduce((acc, arg) => {
        const newAcc = acc;
        cliKeys.forEach((cliKey) => {
            if (arg.startsWith(cliKey.cliPrefix))
                newAcc[cliKey.optionKey] = arg.replace(cliKey.cliPrefix, '');
        });
        return newAcc;
    }, defaultCliOptions);

    const typeDocConfig = JSON.parse(
        fs.readFileSync('./typedocConverter.json').toString(),
    );

    cliOptions = {
        ...cliOptions,
        ...typeDocConfig,
    };

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
