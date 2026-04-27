import { Inject, Injectable } from "@nestjs/common";
import { GetVerdictCountsForTaskUseCase } from "../application/get.verdict.counts.for.task.usecase.js";
import type {
    IVerdictCount,
    VerdictCountTotals,
} from "../public/iservice/verdict.count.iservice.js";

@Injectable()
export class VerdictCountPublicAdapter implements IVerdictCount {
    constructor(
        @Inject(GetVerdictCountsForTaskUseCase) private readonly inner: GetVerdictCountsForTaskUseCase,
    ) {}

    countForTask(taskId: string): Promise<VerdictCountTotals> {
        return this.inner.execute({ taskId });
    }
}
