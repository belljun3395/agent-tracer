import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchSimilarWorkflowsUseCase } from "~application/workflow/index.js";
import {
    similarWorkflowQuerySchema,
    type SimilarWorkflowQuery,
} from "~adapters/http/query/schemas/evaluation.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/workflows")
export class WorkflowIngestController {
    constructor(
        @Inject(SearchSimilarWorkflowsUseCase) private readonly searchSimilarWorkflows: SearchSimilarWorkflowsUseCase,
    ) {}

    // semantic search used by monitor_find_similar_workflows tool
    @Get("similar")
    async findSimilar(@Query(new ZodValidationPipe(similarWorkflowQuerySchema)) query: SimilarWorkflowQuery) {
        return this.searchSimilarWorkflows.execute(query.q, query.tags, query.limit);
    }
}
