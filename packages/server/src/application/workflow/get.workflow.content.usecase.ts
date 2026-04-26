import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "~domain/workflow/index.js";
import type { GetWorkflowContentUseCaseIn, GetWorkflowContentUseCaseOut } from "./dto/get.workflow.content.usecase.dto.js";

export class GetWorkflowContentUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: GetWorkflowContentUseCaseIn): Promise<GetWorkflowContentUseCaseOut> {
        return this.evaluationRepo.getWorkflowContent(input.taskId, normalizeWorkflowScopeKey(input.scopeKey));
    }
}
