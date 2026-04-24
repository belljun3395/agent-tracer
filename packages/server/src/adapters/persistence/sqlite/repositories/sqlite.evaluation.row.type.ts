import type {
    PersistedTaskEvaluation,
    StoredTaskEvaluation,
    WorkflowSummary,
} from "~application/ports/repository/evaluation.repository.js";
import type { SavedBriefing } from "~domain/workflow/briefing.js";
import type { ReusableTaskSnapshot } from "~domain/workflow/task.snapshot.js";
import { parseJsonField } from "../shared/sqlite.json";

export interface EvaluationRow {
    task_id: string;
    scope_key: string;
    scope_kind: string;
    scope_label: string;
    turn_index: number | null;
    rating: string;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    version: number;
    promoted_to: string | null;
    reuse_count: number;
    last_reused_at: string | null;
    briefing_copy_count: number;
    workflow_snapshot_json: string | null;
    workflow_context: string | null;
    search_text: string | null;
    evaluated_at: string;
}

export interface TaskWithEvaluationRow {
    task_id: string;
    scope_key: string;
    scope_kind: string;
    scope_label: string;
    turn_index: number | null;
    title: string;
    slug: string;
    workspace_path: string | null;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    version: number;
    promoted_to: string | null;
    reuse_count: number;
    last_reused_at: string | null;
    briefing_copy_count: number;
    workflow_snapshot_json: string | null;
    workflow_context: string | null;
    search_text: string | null;
    embedding: string | null;
    embedding_model: string | null;
    rating: string;
    event_count: number;
    created_at: string;
    evaluated_at: string;
}

export interface RankedWorkflowRow {
    readonly row: TaskWithEvaluationRow;
    readonly lexicalScore: number;
    readonly semanticScore: number | null;
}

export interface BriefingRow {
    id: string;
    task_id: string;
    generated_at: string;
    purpose: string;
    format: string;
    memo: string | null;
    content: string;
}

export function buildQualitySignals(
    row:
        | Pick<TaskWithEvaluationRow, "reuse_count" | "last_reused_at" | "briefing_copy_count" | "rating">
        | Pick<EvaluationRow, "reuse_count" | "last_reused_at" | "briefing_copy_count" | "rating">,
): WorkflowSummary["qualitySignals"] {
    return {
        reuseCount: row.reuse_count,
        lastReusedAt: row.last_reused_at,
        briefingCopyCount: row.briefing_copy_count,
        manualRating: row.rating as "good" | "skip",
    };
}

export function mapEvaluationRow(row: EvaluationRow): StoredTaskEvaluation {
    return {
        taskId: row.task_id,
        scopeKey: row.scope_key,
        scopeKind: row.scope_kind as "task" | "turn",
        scopeLabel: row.scope_label,
        turnIndex: row.turn_index,
        rating: row.rating as "good" | "skip",
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        version: row.version,
        promotedTo: row.promoted_to,
        qualitySignals: buildQualitySignals(row),
        workflowSnapshot: row.workflow_snapshot_json
            ? parseJsonField<ReusableTaskSnapshot>(row.workflow_snapshot_json)
            : null,
        workflowContext: row.workflow_context,
        searchText: row.search_text,
        evaluatedAt: row.evaluated_at,
    };
}

export function mapBriefingRow(row: BriefingRow): SavedBriefing {
    return {
        id: row.id,
        taskId: row.task_id,
        generatedAt: row.generated_at,
        purpose: row.purpose as SavedBriefing["purpose"],
        format: row.format as SavedBriefing["format"],
        memo: row.memo,
        content: row.content,
    };
}

export function buildEvaluationData(
    value:
        | Pick<TaskWithEvaluationRow, "use_case" | "workflow_tags" | "outcome_note" | "approach_note" | "reuse_when" | "watchouts">
        | Pick<PersistedTaskEvaluation, "useCase" | "workflowTags" | "outcomeNote" | "approachNote" | "reuseWhen" | "watchouts">,
): { useCase: string | null; workflowTags: readonly string[]; outcomeNote: string | null; approachNote: string | null; reuseWhen: string | null; watchouts: string | null } {
    if ("use_case" in value) {
        return {
            useCase: value.use_case,
            workflowTags: value.workflow_tags ? parseJsonField<string[]>(value.workflow_tags) : [],
            outcomeNote: value.outcome_note,
            approachNote: value.approach_note,
            reuseWhen: value.reuse_when,
            watchouts: value.watchouts,
        };
    }
    return {
        useCase: value.useCase ?? null,
        workflowTags: value.workflowTags,
        outcomeNote: value.outcomeNote ?? null,
        approachNote: value.approachNote ?? null,
        reuseWhen: value.reuseWhen ?? null,
        watchouts: value.watchouts ?? null,
    };
}
