import type { IPlaybookRepository, PlaybookUpsertInput } from "../ports/index.js";

export class UpdatePlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(playbookId: string, input: Partial<PlaybookUpsertInput>) {
        return this.evaluationRepo.updatePlaybook(playbookId, input);
    }
}
