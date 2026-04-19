import type { WorkflowContentRecord, PlaybookRecordResponse } from "../../../io.js";
import type { EditorDraft } from "./types.js";

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
