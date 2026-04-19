import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "./workflow.scope.ops.js";

export class GetWorkflowContentUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(taskId: string, scopeKey?: string) {
        return this.evaluationRepo.getWorkflowContent(taskId, normalizeWorkflowScopeKey(scopeKey));
    }
}
