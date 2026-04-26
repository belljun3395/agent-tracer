import type { IEvaluationRepository } from "../ports/index.js";
import type { SearchSimilarWorkflowsUseCaseIn, SearchSimilarWorkflowsUseCaseOut } from "./dto/search.similar.workflows.usecase.dto.js";

export class SearchSimilarWorkflowsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: SearchSimilarWorkflowsUseCaseIn): Promise<SearchSimilarWorkflowsUseCaseOut> {
        return this.evaluationRepo.searchSimilarWorkflows(input.query, input.tags, input.limit);
    }
}
