import type { IEvaluationRepository } from "../ports/index.js";
import type { SearchWorkflowLibraryUseCaseIn, SearchWorkflowLibraryUseCaseOut } from "./dto/search.workflow.library.usecase.dto.js";

export class SearchWorkflowLibraryUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: SearchWorkflowLibraryUseCaseIn): Promise<SearchWorkflowLibraryUseCaseOut> {
        return this.evaluationRepo.searchWorkflowLibrary(input.query, input.rating, input.limit);
    }
}
