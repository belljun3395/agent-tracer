import type { IPlaybookRepository, PlaybookUpsertInput } from "../ports/index.js";
import type { CreatePlaybookUseCaseIn, CreatePlaybookUseCaseOut } from "./dto/create.playbook.usecase.dto.js";

export class CreatePlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(input: CreatePlaybookUseCaseIn): Promise<CreatePlaybookUseCaseOut> {
        const playbook: PlaybookUpsertInput = {
            title: input.title,
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.whenToUse !== undefined ? { whenToUse: input.whenToUse } : {}),
            ...(input.prerequisites !== undefined ? { prerequisites: input.prerequisites } : {}),
            ...(input.approach !== undefined ? { approach: input.approach } : {}),
            ...(input.keySteps !== undefined ? { keySteps: input.keySteps } : {}),
            ...(input.watchouts !== undefined ? { watchouts: input.watchouts } : {}),
            ...(input.antiPatterns !== undefined ? { antiPatterns: input.antiPatterns } : {}),
            ...(input.failureModes !== undefined ? { failureModes: input.failureModes } : {}),
            ...(input.variants !== undefined ? { variants: input.variants } : {}),
            ...(input.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: input.relatedPlaybookIds } : {}),
            ...(input.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: input.sourceSnapshotIds } : {}),
            ...(input.tags !== undefined ? { tags: input.tags } : {}),
        };
        return this.evaluationRepo.createPlaybook(playbook);
    }
}
