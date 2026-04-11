import { buildReusableTaskSnapshot, buildWorkflowContext, type PlaybookStatus, type ReusableTaskSnapshot, type TaskId, } from "@monitor/core";
import type { MonitorPorts } from "../ports";
import { deriveTaskDisplayTitle } from "./task-display-title-resolver.helpers.js";
import type { TaskLifecycleService } from "./task-lifecycle-service.js";
export class WorkflowEvaluationService {
    constructor(private readonly ports: MonitorPorts, private readonly taskLifecycle: TaskLifecycleService) { }
    async upsertTaskEvaluation(taskId: TaskId, input: {
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
        const events = await this.ports.events.findByTaskId(taskId);
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
    async getTaskEvaluation(taskId: TaskId) {
        return this.ports.evaluations.getEvaluation(taskId);
    }
    async recordBriefingCopy(taskId: TaskId) {
        await this.ports.evaluations.recordBriefingCopy(taskId, new Date().toISOString());
    }
    async saveBriefing(taskId: TaskId, input: Parameters<MonitorPorts["evaluations"]["saveBriefing"]>[1]) {
        return this.ports.evaluations.saveBriefing(taskId, input);
    }
    async listBriefings(taskId: TaskId) {
        return this.ports.evaluations.listBriefings(taskId);
    }
    async getWorkflowContent(taskId: TaskId) {
        return this.ports.evaluations.getWorkflowContent(taskId);
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
