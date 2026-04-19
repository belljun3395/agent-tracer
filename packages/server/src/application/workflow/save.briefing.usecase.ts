import type { IEvaluationRepository, BriefingSaveInput } from "../ports/index.js";

export class SaveBriefingUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(taskId: string, input: BriefingSaveInput) {
        return this.evaluationRepo.saveBriefing(taskId, input);
    }
}
