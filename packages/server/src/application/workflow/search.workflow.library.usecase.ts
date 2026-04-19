import type { IEvaluationRepository } from "../ports/index.js";

export class SearchWorkflowLibraryUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(query: string, rating?: "good" | "skip", limit?: number) {
        return this.evaluationRepo.searchWorkflowLibrary(query, rating, limit);
    }
}
