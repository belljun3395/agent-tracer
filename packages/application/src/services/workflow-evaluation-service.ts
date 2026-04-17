import { buildReusableTaskSnapshot, buildWorkflowContext, filterEventsByTurnRange, segmentEventsByTurn } from "../workflow/index.js";
import type { PlaybookStatus, ReusableTaskSnapshot, TaskId, TimelineEvent } from "@monitor/domain";
import type { MonitorPorts } from "../ports";
import { deriveTaskDisplayTitle } from "./task-display-title-resolver.helpers.js";
import type { TaskLifecycleService } from "./task-lifecycle-service.js";
export class WorkflowEvaluationService {
    constructor(private readonly ports: MonitorPorts, private readonly taskLifecycle: TaskLifecycleService) { }
    async upsertTaskEvaluation(taskId: TaskId, input: {
        readonly scopeKey?: string;
        readonly rating: "good" | "skip";
        readonly useCase?: string;
        readonly workflowTags?: string[];
        readonly outcomeNote?: string;
        readonly approachNote?: string;
        readonly reuseWhen?: string;
        readonly watchouts?: string;
        readonly workflowSnapshot?: ReusableTaskSnapshot | null;
        readonly workflowContext?: string;
    }): Promise<void> {
        const task = await this.taskLifecycle.requireTask(taskId);
        const allEvents = await this.ports.events.findByTaskId(taskId);
        const scope = resolveWorkflowScope(input.scopeKey, allEvents);
        const events = filterWorkflowEventsByScope(allEvents, scope.scopeKey);
        const evaluation = {
            useCase: input.useCase ?? null,
            workflowTags: input.workflowTags ?? [],
            outcomeNote: input.outcomeNote ?? null,
            approachNote: input.approachNote ?? null,
            reuseWhen: input.reuseWhen ?? null,
            watchouts: input.watchouts ?? null,
        } as const;
        const workflowTitle = deriveTaskDisplayTitle(task, events) ?? task.title;
        const snapshot = input.workflowSnapshot ??
            buildReusableTaskSnapshot({
                objective: workflowTitle,
                events,
                evaluation,
            });
        const workflowContext = normalizeWorkflowContextOverride(input.workflowContext) ??
            buildWorkflowContext(events, workflowTitle, evaluation, snapshot);
        await this.ports.evaluations.upsertEvaluation({
            taskId,
            scopeKey: scope.scopeKey,
            scopeKind: scope.scopeKind,
            scopeLabel: scope.scopeLabel,
            turnIndex: scope.turnIndex,
            rating: input.rating,
            useCase: evaluation.useCase,
            workflowTags: evaluation.workflowTags,
            outcomeNote: evaluation.outcomeNote,
            approachNote: evaluation.approachNote,
            reuseWhen: evaluation.reuseWhen,
            watchouts: evaluation.watchouts,
            workflowSnapshot: snapshot,
            workflowContext,
            searchText: snapshot.searchText,
            evaluatedAt: new Date().toISOString(),
        });
    }
    async getTaskEvaluation(taskId: TaskId, scopeKey?: string) {
        return this.ports.evaluations.getEvaluation(taskId, normalizeWorkflowScopeKey(scopeKey));
    }
    async recordBriefingCopy(taskId: TaskId, scopeKey?: string) {
        await this.ports.evaluations.recordBriefingCopy(taskId, new Date().toISOString(), normalizeWorkflowScopeKey(scopeKey));
    }
    async saveBriefing(taskId: TaskId, input: Parameters<MonitorPorts["evaluations"]["saveBriefing"]>[1]) {
        return this.ports.evaluations.saveBriefing(taskId, input);
    }
    async listBriefings(taskId: TaskId) {
        return this.ports.evaluations.listBriefings(taskId);
    }
    async getWorkflowContent(taskId: TaskId, scopeKey?: string) {
        return this.ports.evaluations.getWorkflowContent(taskId, normalizeWorkflowScopeKey(scopeKey));
    }
    async listEvaluations(rating?: "good" | "skip") {
        return this.ports.evaluations.listEvaluations(rating);
    }
    async searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number) {
        return this.ports.evaluations.searchWorkflowLibrary(query, rating, limit);
    }
    async searchSimilarWorkflows(query: string, tags?: string[], limit?: number) {
        return this.ports.evaluations.searchSimilarWorkflows(query, tags, limit);
    }
    async listPlaybooks(query?: string, status?: PlaybookStatus, limit?: number) {
        return this.ports.evaluations.listPlaybooks(query, status, limit);
    }
    async getPlaybook(playbookId: string) {
        return this.ports.evaluations.getPlaybook(playbookId);
    }
    async createPlaybook(input: Parameters<MonitorPorts["evaluations"]["createPlaybook"]>[0]) {
        return this.ports.evaluations.createPlaybook(input);
    }
    async updatePlaybook(playbookId: string, input: Parameters<MonitorPorts["evaluations"]["updatePlaybook"]>[1]) {
        return this.ports.evaluations.updatePlaybook(playbookId, input);
    }
}
function normalizeWorkflowContextOverride(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

type WorkflowScopeDetails = {
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
};

function normalizeWorkflowScopeKey(value?: string | null): string {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "task") {
        return "task";
    }
    if (trimmed === "last-turn") {
        return trimmed;
    }
    const match = /^turn:(\d+)$/.exec(trimmed);
    if (!match) {
        return "task";
    }
    const turnIndex = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(turnIndex) && turnIndex > 0 ? `turn:${turnIndex}` : "task";
}

function resolveWorkflowScope(scopeKey: string | undefined, events: readonly TimelineEvent[]): WorkflowScopeDetails {
    const normalized = normalizeWorkflowScopeKey(scopeKey);
    if (normalized === "task") {
        return {
            scopeKey: "task",
            scopeKind: "task",
            scopeLabel: "Whole task",
            turnIndex: null,
        };
    }
    if (normalized === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((segment) => !segment.isPrelude);
        const lastTurn = segments[segments.length - 1];
        return {
            scopeKey: normalized,
            scopeKind: "turn",
            scopeLabel: "Last turn",
            turnIndex: lastTurn?.turnIndex ?? null,
        };
    }
    const turnIndex = Number.parseInt(normalized.slice("turn:".length), 10);
    return {
        scopeKey: normalized,
        scopeKind: "turn",
        scopeLabel: `Turn ${turnIndex}`,
        turnIndex,
    };
}

function filterWorkflowEventsByScope(events: readonly TimelineEvent[], scopeKey: string): readonly TimelineEvent[] {
    if (scopeKey === "task") {
        return events;
    }
    if (scopeKey === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((segment) => !segment.isPrelude);
        const lastTurn = segments[segments.length - 1];
        if (!lastTurn) {
            return events;
        }
        return filterEventsByTurnRange(events, { from: lastTurn.turnIndex, to: lastTurn.turnIndex });
    }
    const turnIndex = Number.parseInt(scopeKey.slice("turn:".length), 10);
    if (!Number.isFinite(turnIndex)) {
        return events;
    }
    return filterEventsByTurnRange(events, { from: turnIndex, to: turnIndex });
}
