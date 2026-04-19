import type { IEvaluationRepository } from "../ports/index.js";

export class ListBriefingsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(taskId: string) {
        return this.evaluationRepo.listBriefings(taskId);
    }
}
