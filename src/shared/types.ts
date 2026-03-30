// src/shared/types.ts

export type ReadStatus = 'unread' | 'reading' | 'read';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';
export type FolderId = string;

export interface Article {
    id: string;
    url: string;
    title: string;
    domain: string;
    savedAt: number;
    status: ReadStatus;
    folderId: FolderId | null;
    highlights: Highlight[];
}

export interface Highlight {
    id: string;
    articleId: string;
    color: HighlightColor;
    selectedText: string;
    anchorStrategy: 'text-context' | 'xpath';
    anchor: TextContextAnchor | XPathAnchor;
    note: string | null;
    createdAt: number;
}

export interface TextContextAnchor {
    type: 'text-context';
    prefix: string;
    exact: string;
    suffix: string;
}

export interface XPathAnchor {
    type: 'xpath';
    xpath: string;
    startOffset: number;
    endOffset: number;
}

export interface Folder {
    id: FolderId;
    name: string;
    createdAt: number;
    color: string;
}

export interface AppSettings {
    defaultHighlightColor: HighlightColor;
}

export interface IStorageSchema {
    articles: Record<string, Article>;
    folders: Record<string, Folder>;
    settings: AppSettings;
}
