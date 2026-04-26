import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import {
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchSimilarWorkflowsUseCase,
    SearchWorkflowLibraryUseCase,
} from "~application/workflow/index.js";
import {
    similarWorkflowQuerySchema,
    type SimilarWorkflowQuery,
} from "~adapters/http/shared/schemas/similar-workflow.query.schema.js";
import {
    workflowListQuerySchema,
    type WorkflowListQuery,
} from "~adapters/http/query/schemas/workflow.query.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/workflows")
export class WorkflowQueryController {
    constructor(
        @Inject(SearchSimilarWorkflowsUseCase) private readonly searchSimilarWorkflows: SearchSimilarWorkflowsUseCase,
        @Inject(GetWorkflowContentUseCase) private readonly getWorkflowContent: GetWorkflowContentUseCase,
        @Inject(ListEvaluationsUseCase) private readonly listEvaluations: ListEvaluationsUseCase,
        @Inject(SearchWorkflowLibraryUseCase) private readonly searchWorkflowLibrary: SearchWorkflowLibraryUseCase,
    ) {}

    @Get("similar")
    async findSimilar(@Query(new ZodValidationPipe(similarWorkflowQuerySchema)) query: SimilarWorkflowQuery) {
        return this.searchSimilarWorkflows.execute({ query: query.q, tags: query.tags, limit: query.limit });
    }

    @Get(":id/content")
    async getWorkflowContentEndpoint(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        const content = await this.getWorkflowContent.execute({ taskId, scopeKey });
        if (!content) throw new NotFoundException("workflow content not found");
        return content;
    }

    @Get()
    async listWorkflows(@Query(new ZodValidationPipe(workflowListQuerySchema)) query: WorkflowListQuery) {
        if (query.q) {
            return this.searchWorkflowLibrary.execute({ query: query.q, rating: query.rating, limit: query.limit });
        }
        return this.listEvaluations.execute({ rating: query.rating });
    }
}
