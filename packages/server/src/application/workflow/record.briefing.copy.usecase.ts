import type { IEvaluationRepository } from "../ports/index.js";
import { normalizeWorkflowScopeKey } from "~domain/workflow/index.js";
import type { RecordBriefingCopyUseCaseIn, RecordBriefingCopyUseCaseOut } from "./dto/record.briefing.copy.usecase.dto.js";

export class RecordBriefingCopyUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: RecordBriefingCopyUseCaseIn): Promise<RecordBriefingCopyUseCaseOut> {
        await this.evaluationRepo.recordBriefingCopy(input.taskId, new Date().toISOString(), normalizeWorkflowScopeKey(input.scopeKey));
    }
}
