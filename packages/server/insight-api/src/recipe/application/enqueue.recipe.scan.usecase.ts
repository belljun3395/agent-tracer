import { Inject, Injectable } from "@nestjs/common";
import { RecipeScanService } from "../service/recipe.scan.service.js";
import {
    RECIPE_SCAN_DISPATCHER,
    type IRecipeScanDispatcher,
} from "./outbound/recipe.scan.dispatcher.port.js";
import type { EnqueueRecipeScanInput } from "./dto/recipe.scan.dto.js";

/** recipe scan 작업을 enqueue하고 실행을 워커로 넘긴다. */
@Injectable()
export class EnqueueRecipeScanUseCase {
    constructor(
        private readonly service: RecipeScanService,
        @Inject(RECIPE_SCAN_DISPATCHER)
        private readonly dispatcher: IRecipeScanDispatcher,
    ) {}

    async execute(input: EnqueueRecipeScanInput = {}) {
        const job = await this.service.enqueue(input);
        await this.dispatcher.dispatch(job.id);
        return { jobId: job.id, status: job.status, createdAt: job.createdAt };
    }
}
