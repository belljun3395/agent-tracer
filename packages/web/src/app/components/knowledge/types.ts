import type { WorkflowSummaryRecord, PlaybookSummaryRecord } from "../../../io.js";

export type SnapshotFilter = "all" | "good" | "skip";
export type PlaybookFilter = "all" | "active" | "draft" | "archived";
export type TabKey = "library" | "playbooks";
export type EditorMode = "create" | "edit";

export type EditorDraft = {
    readonly id?: string;
    title: string;
    status: "draft" | "active" | "archived";
    whenToUse: string;
    prerequisites: string;
    approach: string;
    keySteps: string;
    watchouts: string;
    antiPatterns: string;
    failureModes: string;
    tags: string;
    sourceSnapshotIds: readonly string[];
};

export type KnowledgeItem = WorkflowSummaryRecord | PlaybookSummaryRecord;
