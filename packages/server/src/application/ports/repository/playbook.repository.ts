import type { PlaybookRecord, PlaybookStatus, PlaybookSummary } from "~domain/workflow/index.js";

export type { PlaybookRecord, PlaybookSummary };

export interface PlaybookUpsertInput {
    readonly title: string;
    readonly status?: PlaybookStatus;
    readonly whenToUse?: string | null;
    readonly prerequisites?: readonly string[];
    readonly approach?: string | null;
    readonly keySteps?: readonly string[];
    readonly watchouts?: readonly string[];
    readonly antiPatterns?: readonly string[];
    readonly failureModes?: readonly string[];
    readonly variants?: PlaybookRecord["variants"];
    readonly relatedPlaybookIds?: readonly string[];
    readonly sourceSnapshotIds?: readonly string[];
    readonly tags?: readonly string[];
}

export interface IPlaybookRepository {
    listPlaybooks(query?: string, status?: PlaybookStatus, limit?: number): Promise<readonly PlaybookSummary[]>;
    getPlaybook(playbookId: string): Promise<PlaybookRecord | null>;
    createPlaybook(input: PlaybookUpsertInput): Promise<PlaybookRecord>;
    updatePlaybook(playbookId: string, input: Partial<PlaybookUpsertInput>): Promise<PlaybookRecord | null>;
}
