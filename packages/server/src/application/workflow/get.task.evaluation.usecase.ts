import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "~domain/index.js";
import type { GetTaskEvaluationUseCaseIn, GetTaskEvaluationUseCaseOut } from "./dto/get.task.evaluation.usecase.dto.js";

export class GetTaskEvaluationUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: GetTaskEvaluationUseCaseIn): Promise<GetTaskEvaluationUseCaseOut> {
        return this.evaluationRepo.getEvaluation(input.taskId, normalizeWorkflowScopeKey(input.scopeKey));
    }
}
