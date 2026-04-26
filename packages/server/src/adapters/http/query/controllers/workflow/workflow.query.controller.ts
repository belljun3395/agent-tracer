import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import {
    SearchSimilarWorkflowsUseCase,
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchWorkflowLibraryUseCase,
} from "~application/workflow/index.js";
import {
    similarWorkflowQuerySchema,
    workflowListQuerySchema,
    type SimilarWorkflowQuery,
    type WorkflowListQuery,
} from "~adapters/http/query/schemas/evaluation.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/workflows")
export class WorkflowController {
    constructor(
        @Inject(SearchSimilarWorkflowsUseCase) private readonly searchSimilarWorkflows: SearchSimilarWorkflowsUseCase,
        @Inject(GetWorkflowContentUseCase) private readonly getWorkflowContent: GetWorkflowContentUseCase,
        @Inject(ListEvaluationsUseCase) private readonly listEvaluations: ListEvaluationsUseCase,
        @Inject(SearchWorkflowLibraryUseCase) private readonly searchWorkflowLibrary: SearchWorkflowLibraryUseCase,
    ) {}

    // semantic search used in UI workflow library and by monitor_find_similar_workflows tool
    @Get("similar")
    async findSimilar(@Query(new ZodValidationPipe(similarWorkflowQuerySchema)) query: SimilarWorkflowQuery) {
        return this.searchSimilarWorkflows.execute(query.q, query.tags, query.limit);
    }

    // loads full workflow snapshot for the workflow detail view
    @Get(":id/content")
    async getWorkflowContentEndpoint(
        @Param("id", pathParamPipe) taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        const content = await this.getWorkflowContent.execute(taskId, scopeKey);
        if (!content) throw new NotFoundException("workflow content not found");
        return content;
    }

    // lists or keyword-searches the workflow library
    @Get()
    async listWorkflows(@Query(new ZodValidationPipe(workflowListQuerySchema)) query: WorkflowListQuery) {
        if (query.q) return this.searchWorkflowLibrary.execute(query.q, query.rating, query.limit);
        return this.listEvaluations.execute(query.rating);
    }
}
