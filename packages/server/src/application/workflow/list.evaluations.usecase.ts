import type { IEvaluationRepository } from "../ports/index.js";
import type { ListEvaluationsUseCaseIn, ListEvaluationsUseCaseOut } from "./dto/list.evaluations.usecase.dto.js";

export class ListEvaluationsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: ListEvaluationsUseCaseIn): Promise<ListEvaluationsUseCaseOut> {
        return this.evaluationRepo.listEvaluations(input.rating);
    }
}
