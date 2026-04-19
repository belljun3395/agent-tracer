import type { PersistedTaskEvaluation, WorkflowSummary } from "~application/ports/repository/evaluation.repository.js";
import type { MonitoringTask } from "~domain/monitoring/monitoring.task.model.js";
import type { TimelineEvent } from "~domain/monitoring/timeline.event.model.js";
import { buildReusableTaskSnapshot } from "~domain/workflow/task.snapshot.js";
import { buildWorkflowContext } from "~domain/workflow/workflow.context.js";
import { filterEventsByTurnRange, segmentEventsByTurn } from "~domain/workflow/segments.js";
import { normalizeEmbeddingSection, normalizeSearchText } from "../shared/text.normalizers.js";
import { deriveTaskDisplayTitle, meaningfulTaskTitle } from "~application/index.js";
import { parseJsonField } from "../shared/sqlite.json";
import type { RankedWorkflowRow, TaskWithEvaluationRow } from "../repositories/sqlite.evaluation.row.type.js";
import { buildEvaluationData, buildQualitySignals } from "../repositories/sqlite.evaluation.row.type.js";

export const MIN_SEMANTIC_SCORE = 0.22;

export function buildSnapshotId(taskId: string, scopeKey: string): string {
    return `${taskId}#${scopeKey}`;
}

export function buildWorkflowTask(
    row: Pick<TaskWithEvaluationRow, "task_id" | "title" | "slug" | "workspace_path" | "created_at" | "evaluated_at">,
): MonitoringTask {
    return {
        id: row.task_id,
        title: row.title,
        slug: row.slug,
        status: "completed",
        createdAt: row.created_at,
        updatedAt: row.evaluated_at,
        ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
    };
}

export function resolveWorkflowDisplayTitle(
    row: Pick<TaskWithEvaluationRow, "task_id" | "title" | "slug" | "workspace_path" | "created_at" | "evaluated_at">,
    events: readonly TimelineEvent[],
): string | undefined {
    const displayTitle = deriveTaskDisplayTitle(buildWorkflowTask(row), events);
    return displayTitle && displayTitle !== row.title ? displayTitle : undefined;
}

export function shouldResolveDisplayTitle(row: TaskWithEvaluationRow): boolean {
    return !meaningfulTaskTitle(buildWorkflowTask(row));
}

export function mapWorkflowSummary(row: TaskWithEvaluationRow, eventCount: number, displayTitle?: string): WorkflowSummary {
    return {
        layer: "snapshot",
        snapshotId: buildSnapshotId(row.task_id, row.scope_key),
        taskId: row.task_id,
        scopeKey: row.scope_key,
        scopeKind: row.scope_kind as "task" | "turn",
        scopeLabel: row.scope_label,
        turnIndex: row.turn_index,
        title: row.title,
        ...(displayTitle ? { displayTitle } : {}),
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        rating: row.rating as "good" | "skip",
        eventCount,
        createdAt: row.created_at,
        evaluatedAt: row.evaluated_at,
        version: row.version,
        promotedTo: row.promoted_to,
        qualitySignals: buildQualitySignals(row),
    };
}

export function mergeRankedRows(
    semanticMatches: readonly { row: TaskWithEvaluationRow; score: number }[],
    lexicalMatches: readonly { row: TaskWithEvaluationRow; score: number }[],
    limit: number,
): readonly TaskWithEvaluationRow[] {
    const ranked = new Map<string, RankedWorkflowRow>();
    for (const semantic of semanticMatches) {
        ranked.set(buildSnapshotId(semantic.row.task_id, semantic.row.scope_key), {
            row: semantic.row,
            lexicalScore: 0,
            semanticScore: semantic.score,
        });
    }
    for (const lexical of lexicalMatches) {
        const rankKey = buildSnapshotId(lexical.row.task_id, lexical.row.scope_key);
        const existing = ranked.get(rankKey);
        if (existing) {
            ranked.set(rankKey, { ...existing, lexicalScore: Math.max(existing.lexicalScore, lexical.score) });
            continue;
        }
        ranked.set(rankKey, { row: lexical.row, lexicalScore: lexical.score, semanticScore: null });
    }
    return [...ranked.values()]
        .sort(
            (left, right) =>
                combinedRankScore(right) - combinedRankScore(left) ||
                (right.semanticScore ?? 0) - (left.semanticScore ?? 0) ||
                right.lexicalScore - left.lexicalScore ||
                compareRatedRows(left.row, right.row),
        )
        .slice(0, limit)
        .map((entry) => entry.row);
}

export function scoreLexicalMatches(
    rows: readonly TaskWithEvaluationRow[],
    query: string,
): readonly { row: TaskWithEvaluationRow; score: number }[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];
    const queryTokens = tokenizeText(normalizedQuery);
    return rows
        .map((row) => ({ row, score: computeLexicalScore(row, normalizedQuery, queryTokens) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || compareRatedRows(left.row, right.row));
}

export function applyTagFilter<T extends { workflow_tags: string | null }>(
    rows: readonly T[],
    tags: readonly string[] | undefined,
): readonly T[] {
    if (!tags || tags.length === 0) return rows;
    return rows.filter((row) => {
        if (!row.workflow_tags) return false;
        const rowTags = parseJsonField<string[]>(row.workflow_tags);
        return tags.some((tag) => rowTags.some((rowTag) => rowTag.toLocaleLowerCase().includes(tag.toLocaleLowerCase())));
    });
}

export function compareWorkflowSummaryRows(left: TaskWithEvaluationRow, right: TaskWithEvaluationRow): number {
    return compareRatedRows(left, right);
}

export function filterWorkflowEventsForScopeKey(events: readonly TimelineEvent[], scopeKey: string): readonly TimelineEvent[] {
    if (scopeKey === "task") return events;
    if (scopeKey === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((segment) => !segment.isPrelude);
        const lastTurn = segments[segments.length - 1];
        if (!lastTurn) return events;
        return filterEventsByTurnRange(events, { from: lastTurn.turnIndex, to: lastTurn.turnIndex });
    }
    const turnMatch = /^turn:(\d+)$/.exec(scopeKey);
    if (!turnMatch) return events;
    const turnIndex = Number.parseInt(turnMatch[1] ?? "", 10);
    if (!Number.isFinite(turnIndex)) return events;
    return filterEventsByTurnRange(events, { from: turnIndex, to: turnIndex });
}

export function buildEmbeddingText(evaluation: PersistedTaskEvaluation, events: readonly TimelineEvent[], title: string): string {
    const evalData = buildEvaluationData(evaluation);
    const workflowSnapshot = evaluation.workflowSnapshot ?? buildReusableTaskSnapshot({ objective: title, events, evaluation: evalData });
    const workflowContext = evaluation.workflowContext ?? buildWorkflowContext(events, title, evalData, workflowSnapshot);
    const parts = [
        title,
        evaluation.useCase,
        evaluation.workflowTags.join(" "),
        evaluation.outcomeNote,
        evaluation.approachNote,
        evaluation.reuseWhen,
        evaluation.watchouts,
        evaluation.searchText ?? workflowSnapshot.searchText,
        workflowContext,
    ];
    return parts
        .map((part) => normalizeEmbeddingSection(part))
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
}

export function isClosedDatabaseError(error: unknown): boolean {
    return error instanceof Error && /database connection is not open/i.test(error.message);
}

function combinedRankScore(entry: RankedWorkflowRow): number {
    return (entry.semanticScore ?? 0) * 100 + entry.lexicalScore;
}

function computeLexicalScore(row: TaskWithEvaluationRow, normalizedQuery: string, queryTokens: readonly string[]): number {
    const fields = buildSearchFields(row);
    const combinedText = fields.map((field) => field.value).filter(Boolean).join(" ");
    const matchedTokens = new Set<string>();
    let score = 0;
    if (combinedText.includes(normalizedQuery)) score += 18;
    for (const field of fields) {
        if (!field.value) continue;
        if (field.value.includes(normalizedQuery)) score += field.weight * 2;
        for (const token of queryTokens) {
            if (!field.value.includes(token)) continue;
            matchedTokens.add(token);
            score += field.weight;
        }
    }
    if (queryTokens.length > 1 && matchedTokens.size === queryTokens.length) {
        score += queryTokens.length * 4;
    }
    return score;
}

function buildSearchFields(row: TaskWithEvaluationRow): ReadonlyArray<{ value: string; weight: number }> {
    const workflowTags = row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags).join(" ") : "";
    return [
        { value: normalizeSearchText(row.title) ?? "", weight: 12 },
        { value: normalizeSearchText(row.use_case) ?? "", weight: 10 },
        { value: normalizeSearchText(workflowTags) ?? "", weight: 8 },
        { value: normalizeSearchText(row.outcome_note) ?? "", weight: 7 },
        { value: normalizeSearchText(row.approach_note) ?? "", weight: 7 },
        { value: normalizeSearchText(row.reuse_when) ?? "", weight: 5 },
        { value: normalizeSearchText(row.watchouts) ?? "", weight: 5 },
        { value: normalizeSearchText(row.search_text) ?? "", weight: 6 },
    ];
}

function tokenizeText(value: string): readonly string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const rawToken of value.split(/[^\p{L}\p{N}]+/u)) {
        const token = rawToken.trim();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        tokens.push(token);
    }
    return tokens.length > 0 ? tokens : [value];
}

function compareRatedRows(left: TaskWithEvaluationRow, right: TaskWithEvaluationRow): number {
    return (
        Number(right.rating === "good") - Number(left.rating === "good") ||
        compareIsoDatesDesc(left.evaluated_at, right.evaluated_at)
    );
}

function compareIsoDatesDesc(left: string, right: string): number {
    return Date.parse(right) - Date.parse(left);
}
