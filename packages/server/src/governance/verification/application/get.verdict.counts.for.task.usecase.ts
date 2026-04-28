import { tallyVerdicts } from "~governance/verification/domain/verdict.js";
import type { ITurnQueryRepository } from "~governance/verification/application/outbound/turn.query.repository.port.js";
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
