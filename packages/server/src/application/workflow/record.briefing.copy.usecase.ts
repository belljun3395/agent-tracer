import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "./workflow.scope.ops.js";

export class RecordBriefingCopyUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(taskId: string, scopeKey?: string): Promise<void> {
        await this.evaluationRepo.recordBriefingCopy(taskId, new Date().toISOString(), normalizeWorkflowScopeKey(scopeKey));
    }
}
