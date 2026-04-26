import type { IEvaluationRepository } from "../ports/index.js";
import type { ListBriefingsUseCaseIn, ListBriefingsUseCaseOut } from "./dto/list.briefings.usecase.dto.js";

export class ListBriefingsUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: ListBriefingsUseCaseIn): Promise<ListBriefingsUseCaseOut> {
        return this.evaluationRepo.listBriefings(input.taskId);
    }
}
