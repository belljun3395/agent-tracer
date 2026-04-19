import type { IEvaluationRepository } from "../ports/index.js";

export class ListEvaluationsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(rating?: "good" | "skip") {
        return this.evaluationRepo.listEvaluations(rating);
    }
}
