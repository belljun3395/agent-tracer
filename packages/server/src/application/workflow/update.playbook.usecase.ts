import type { IPlaybookRepository, PlaybookUpsertInput } from "../ports/index.js";
import type { UpdatePlaybookUseCaseIn, UpdatePlaybookUseCaseOut } from "./dto/update.playbook.usecase.dto.js";

export class UpdatePlaybookUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(input: UpdatePlaybookUseCaseIn): Promise<UpdatePlaybookUseCaseOut> {
        const playbook: Partial<PlaybookUpsertInput> = {
            ...(input.title !== undefined ? { title: input.title } : {}),
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
        return this.evaluationRepo.updatePlaybook(input.playbookId, playbook);
    }
}
