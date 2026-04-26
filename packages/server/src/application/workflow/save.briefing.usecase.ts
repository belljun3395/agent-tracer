import type { BriefingSaveInput, IEvaluationRepository } from "../ports/index.js";
import type { SaveBriefingUseCaseIn, SaveBriefingUseCaseOut } from "./dto/save.briefing.usecase.dto.js";

export class SaveBriefingUseCase {
    constructor(private readonly evaluationRepo: IEvaluationRepository) {}

    async execute(input: SaveBriefingUseCaseIn): Promise<SaveBriefingUseCaseOut> {
        const briefing: BriefingSaveInput = {
            purpose: input.purpose,
            format: input.format,
            content: input.content,
            generatedAt: input.generatedAt,
            ...(input.memo !== undefined ? { memo: input.memo } : {}),
        };
        return this.evaluationRepo.saveBriefing(input.taskId, briefing);
    }
}
