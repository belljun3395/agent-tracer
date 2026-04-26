import type { IPlaybookRepository } from "../ports/index.js";
import type { GetPlaybookUseCaseIn, GetPlaybookUseCaseOut } from "./dto/get.playbook.usecase.dto.js";

export class GetPlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(input: GetPlaybookUseCaseIn): Promise<GetPlaybookUseCaseOut> {
        return this.evaluationRepo.getPlaybook(input.playbookId);
    }
}
