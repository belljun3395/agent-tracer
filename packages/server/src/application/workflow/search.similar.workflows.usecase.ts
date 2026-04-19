import type { IEvaluationRepository } from "../ports/index.js";

export class SearchSimilarWorkflowsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(query: string, tags?: string[], limit?: number) {
        return this.evaluationRepo.searchSimilarWorkflows(query, tags, limit);
    }
}
