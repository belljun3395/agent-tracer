import type { VerdictStatusQueryPort } from "~application/ports/index.js";
import { tallyVerdicts } from "~domain/verification/index.js";
import type {
    GetVerdictCountsForTaskUseCaseIn,
    GetVerdictCountsForTaskUseCaseOut,
} from "./dto/get.verdict.counts.for.task.usecase.dto.js";

export class GetVerdictCountsForTaskUseCase {
    constructor(private readonly turnQueryRepo: VerdictStatusQueryPort) {}

    async execute(input: GetVerdictCountsForTaskUseCaseIn): Promise<GetVerdictCountsForTaskUseCaseOut> {
        const statuses = await this.turnQueryRepo.listVerdictStatusesForTask(input.taskId);
        return tallyVerdicts(statuses);
    }
}
