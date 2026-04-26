import type { IPlaybookRepository } from "../ports/index.js";
import type { ListPlaybooksUseCaseIn, ListPlaybooksUseCaseOut } from "./dto/list.playbooks.usecase.dto.js";

export class ListPlaybooksUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(input: ListPlaybooksUseCaseIn): Promise<ListPlaybooksUseCaseOut> {
        return this.evaluationRepo.listPlaybooks(input.query, input.status, input.limit);
    }
}
