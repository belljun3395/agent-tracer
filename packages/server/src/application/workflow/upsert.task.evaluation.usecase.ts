import { buildReusableTaskSnapshot, buildWorkflowContext, type ReusableTaskSnapshot } from "~domain/index.js";
import { deriveTaskDisplayTitle } from "~application/tasks/utils/task.display.title.util.js";
import type { ITaskRepository, IEventRepository, IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey, resolveWorkflowScope, filterWorkflowEventsByScope } from "./workflow.scope.ops.js";

export type UpsertTaskEvaluationUseCaseIn = {
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
};

export class UpsertTaskEvaluationUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly evaluationRepo: IEvaluationRepository,
    ) {}

    async execute(taskId: string, input: UpsertTaskEvaluationUseCaseIn): Promise<void> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        const allEvents = await this.eventRepo.findByTaskId(taskId);
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
        const snapshot = input.workflowSnapshot ?? buildReusableTaskSnapshot({ objective: workflowTitle, events, evaluation });
        const workflowContext = normalizeContextOverride(input.workflowContext)
            ?? buildWorkflowContext(events, workflowTitle, evaluation, snapshot);

        await this.evaluationRepo.upsertEvaluation({
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
}

function normalizeContextOverride(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export { normalizeWorkflowScopeKey };
