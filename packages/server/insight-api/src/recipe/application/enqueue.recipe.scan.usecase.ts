import { Injectable } from "@nestjs/common";
import { RecipeScanService } from "../service/recipe.scan.service.js";
import type { EnqueueRecipeScanInput } from "./dto/recipe.scan.dto.js";

/** recipe scan 작업을 enqueue한다. */
@Injectable()
export class EnqueueRecipeScanUseCase {
    constructor(private readonly service: RecipeScanService) {}

    async execute(input: EnqueueRecipeScanInput = {}) {
        const job = await this.service.run(input);
        return { jobId: job.id, status: job.status, createdAt: job.createdAt };
    }
}
