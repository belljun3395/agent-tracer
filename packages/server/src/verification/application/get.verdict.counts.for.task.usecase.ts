import { tallyVerdicts } from "~verification/domain/verdict.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import type {
    GetVerdictCountsForTaskUseCaseIn,
    GetVerdictCountsForTaskUseCaseOut,
} from "./dto/get.verdict.counts.for.task.usecase.dto.js";

export class GetVerdictCountsForTaskUseCase {
    constructor(private readonly turnQueryRepo: ITurnQueryRepository) {}

    async execute(input: GetVerdictCountsForTaskUseCaseIn): Promise<GetVerdictCountsForTaskUseCaseOut> {
        const statuses = await this.turnQueryRepo.listVerdictStatusesForTask(input.taskId);
        return tallyVerdicts(statuses);
    }
}
