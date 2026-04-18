import React from "react";
import type { WorkflowContentRecord, PlaybookRecordResponse, WorkflowSummaryRecord, PlaybookSummaryRecord } from "@monitor/web-io";
import { Eyebrow } from "../ui/Eyebrow.js";

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

export const tabButtonClass = "rounded-[var(--radius-md)] border px-2 py-0.75 text-[0.68rem] font-semibold transition-colors";
export const editorFieldClass = "flex flex-col gap-1.5";

export function formatDate(iso: string | null | undefined): string | null {
    if (!iso) {
        return null;
    }
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function createEmptyEditorDraft(): EditorDraft {
    return {
        title: "",
        status: "draft",
        whenToUse: "",
        prerequisites: "",
        approach: "",
        keySteps: "",
        watchouts: "",
        antiPatterns: "",
        failureModes: "",
        tags: "",
        sourceSnapshotIds: []
    };
}

export function createDraftFromSnapshot(content: WorkflowContentRecord): EditorDraft {
    return {
        title: content.workflowSnapshot.objective || content.title,
        status: "draft",
        whenToUse: content.workflowSnapshot.reuseWhen ?? "",
        prerequisites: "",
        approach: content.workflowSnapshot.approachSummary ?? "",
        keySteps: content.workflowSnapshot.keyDecisions.join("\n"),
        watchouts: content.workflowSnapshot.watchItems.join("\n"),
        antiPatterns: "",
        failureModes: "",
        tags: "",
        sourceSnapshotIds: [`${content.snapshotId}:v${content.version}`]
    };
}

export function createDraftFromPlaybook(playbook: PlaybookRecordResponse): EditorDraft {
    return {
        id: playbook.id,
        title: playbook.title,
        status: playbook.status,
        whenToUse: playbook.whenToUse ?? "",
        prerequisites: playbook.prerequisites.join("\n"),
        approach: playbook.approach ?? "",
        keySteps: playbook.keySteps.join("\n"),
        watchouts: playbook.watchouts.join("\n"),
        antiPatterns: playbook.antiPatterns.join("\n"),
        failureModes: playbook.failureModes.join("\n"),
        tags: playbook.tags.join(", "),
        sourceSnapshotIds: playbook.sourceSnapshotIds
    };
}

function normalizeLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeTags(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function buildPlaybookPayloadFromDraft(draft: EditorDraft) {
    return {
        title: draft.title.trim(),
        status: draft.status,
        ...(draft.whenToUse.trim() ? { whenToUse: draft.whenToUse.trim() } : {}),
        ...(draft.approach.trim() ? { approach: draft.approach.trim() } : {}),
        ...(normalizeLines(draft.prerequisites).length > 0 ? { prerequisites: normalizeLines(draft.prerequisites) } : {}),
        ...(normalizeLines(draft.keySteps).length > 0 ? { keySteps: normalizeLines(draft.keySteps) } : {}),
        ...(normalizeLines(draft.watchouts).length > 0 ? { watchouts: normalizeLines(draft.watchouts) } : {}),
        ...(normalizeLines(draft.antiPatterns).length > 0 ? { antiPatterns: normalizeLines(draft.antiPatterns) } : {}),
        ...(normalizeLines(draft.failureModes).length > 0 ? { failureModes: normalizeLines(draft.failureModes) } : {}),
        ...(normalizeTags(draft.tags).length > 0 ? { tags: normalizeTags(draft.tags) } : {}),
        ...(draft.sourceSnapshotIds.length > 0 ? { sourceSnapshotIds: [...draft.sourceSnapshotIds] } : {})
    };
}

export function sortSnapshots(items: readonly WorkflowSummaryRecord[]): readonly WorkflowSummaryRecord[] {
    return [...items].sort((left, right) => Date.parse(right.evaluatedAt) - Date.parse(left.evaluatedAt));
}

export function sortPlaybooks(items: readonly PlaybookSummaryRecord[]): readonly PlaybookSummaryRecord[] {
    const rank = (status: PlaybookSummaryRecord["status"]): number => status === "active" ? 3 : status === "draft" ? 2 : 1;
    return [...items].sort((left, right) => rank(right.status) - rank(left.status) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function SectionLabel({ children }: { readonly children: React.ReactNode; }): React.JSX.Element {
    return React.createElement(Eyebrow, { className: "text-[0.68rem] tracking-[0.06em]" }, children);
}

export function SnapshotField({ label, value }: {
    readonly label: string;
    readonly value: string | null;
}): React.JSX.Element | null {
    if (!value) {
        return null;
    }
    return React.createElement(
        "div",
        { className: "flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" },
        React.createElement(Eyebrow, null, label),
        React.createElement("p", { className: "m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]" }, value)
    );
}

export function SnapshotList({ label, items }: {
    readonly label: string;
    readonly items: readonly string[];
}): React.JSX.Element | null {
    if (items.length === 0) {
        return null;
    }
    return React.createElement(
        "div",
        { className: "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" },
        React.createElement(Eyebrow, null, label),
        React.createElement(
            "div",
            { className: "flex flex-col gap-1.5" },
            ...items.map((item) =>
                React.createElement("p", { key: item, className: "m-0 whitespace-pre-wrap break-words text-[0.8rem] leading-6 text-[var(--text-1)]" }, `- ${item}`)
            )
        )
    );
}
