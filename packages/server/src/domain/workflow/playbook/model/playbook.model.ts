import type { WorkflowSummary } from "~domain/workflow/evaluation/model/task.evaluation.model.js";
import type { WorkflowLayer } from "~domain/workflow/evaluation/type/task.evaluation.type.js";
import type { PlaybookStatus } from "../type/playbook.type.js";

export interface PlaybookVariant {
    readonly label: string;
    readonly description: string;
    readonly differenceFromBase: string;
}

export interface PlaybookSummary {
    readonly layer: Extract<WorkflowLayer, "playbook">;
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: PlaybookStatus;
    readonly whenToUse: string | null;
    readonly tags: readonly string[];
    readonly useCount: number;
    readonly lastUsedAt: string | null;
    readonly sourceSnapshotIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface PlaybookRecord extends PlaybookSummary {
    readonly prerequisites: readonly string[];
    readonly approach: string | null;
    readonly keySteps: readonly string[];
    readonly watchouts: readonly string[];
    readonly antiPatterns: readonly string[];
    readonly failureModes: readonly string[];
    readonly variants: readonly PlaybookVariant[];
    readonly relatedPlaybookIds: readonly string[];
    readonly searchText: string | null;
}

export type KnowledgeItemSummary = WorkflowSummary | PlaybookSummary;
