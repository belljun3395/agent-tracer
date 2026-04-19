import type { IPlaybookRepository, PlaybookUpsertInput } from "../ports/index.js";

export class CreatePlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(input: PlaybookUpsertInput) {
        return this.evaluationRepo.createPlaybook(input);
    }
}
