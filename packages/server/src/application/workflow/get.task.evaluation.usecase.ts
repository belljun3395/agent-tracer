import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "./workflow.scope.ops.js";

export class GetTaskEvaluationUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(taskId: string, scopeKey?: string) {
        return this.evaluationRepo.getEvaluation(taskId, normalizeWorkflowScopeKey(scopeKey));
    }
}
