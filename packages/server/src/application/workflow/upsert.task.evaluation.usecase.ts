import { deriveTaskDisplayTitle } from "~domain/monitoring/index.js";
import {
    filterWorkflowEventsByScope,
    normalizeWorkflowScopeKey,
    resolveWorkflowScope,
} from "~domain/workflow/index.js";
import type { ITaskRepository, IEventRepository, IEvaluationRepository } from "../ports/index.js";
import type { UpsertTaskEvaluationUseCaseIn } from "./dto/upsert.task.evaluation.usecase.dto.js";
import { TaskNotFoundError } from "./common/workflow.errors.js";
import { createReusableTaskSnapshot } from "~domain/workflow/index.js";
import { composeWorkflowContext } from "./projection/workflow.context.js";

export class UpsertTaskEvaluationUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly evaluationRepo: IEvaluationRepository,
    ) {}

    async execute(input: UpsertTaskEvaluationUseCaseIn): Promise<void> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const allEvents = await this.eventRepo.findByTaskId(input.taskId);
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
        const snapshot = input.workflowSnapshot ?? createReusableTaskSnapshot({ objective: workflowTitle, events, evaluation });
        const workflowContext = normalizeContextOverride(input.workflowContext)
            ?? composeWorkflowContext(events, workflowTitle, evaluation, snapshot);

        await this.evaluationRepo.upsertEvaluation({
            taskId: input.taskId,
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
