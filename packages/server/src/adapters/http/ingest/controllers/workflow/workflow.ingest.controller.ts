import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchSimilarWorkflowsUseCase } from "~application/workflow/index.js";
import {
    similarWorkflowQuerySchema,
    type SimilarWorkflowQuery,
} from "~adapters/http/shared/schemas/similar-workflow.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/workflows")
export class WorkflowIngestController {
    constructor(
        @Inject(SearchSimilarWorkflowsUseCase) private readonly searchSimilarWorkflows: SearchSimilarWorkflowsUseCase,
    ) {}

    @Get("similar")
    async findSimilar(@Query(new ZodValidationPipe(similarWorkflowQuerySchema)) query: SimilarWorkflowQuery) {
        return this.searchSimilarWorkflows.execute({ query: query.q, tags: query.tags, limit: query.limit });
    }
}
