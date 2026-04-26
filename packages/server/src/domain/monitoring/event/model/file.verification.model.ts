export interface MentionedExploredFile {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
}

export interface FileMentionVerification {
    readonly mentionType: "file";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly wasExplored: boolean;
    readonly firstExploredAt?: string;
    readonly explorationCount: number;
    readonly exploredAfterMention: boolean;
}

export interface DirectoryMentionVerification {
    readonly mentionType: "directory";
    readonly path: string;
    readonly mentionedAt: string;
    readonly mentionedInEventId: string;
    readonly exploredFilesInFolder: readonly MentionedExploredFile[];
    readonly wasExplored: boolean;
    readonly exploredAfterMention: boolean;
}

export type MentionedFileVerification = FileMentionVerification | DirectoryMentionVerification;
