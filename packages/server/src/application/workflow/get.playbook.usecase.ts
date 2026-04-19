import type { IPlaybookRepository } from "../ports/index.js";

export class GetPlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(playbookId: string) {
        return this.evaluationRepo.getPlaybook(playbookId);
    }
}
