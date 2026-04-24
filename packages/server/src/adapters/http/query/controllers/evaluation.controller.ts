import { Controller, Get, HttpException, HttpStatus, Param, Query, Inject } from "@nestjs/common";
import {
    GetTaskEvaluationUseCase,
    ListBriefingsUseCase,
    SearchSimilarWorkflowsUseCase,
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchWorkflowLibraryUseCase,
    ListPlaybooksUseCase,
    GetPlaybookUseCase,
} from "~application/workflow/usecases.index.js";
import {
    playbookListQuerySchema,
    similarWorkflowQuerySchema,
    workflowListQuerySchema,
    type PlaybookListQuery,
    type SimilarWorkflowQuery,
    type WorkflowListQuery,
} from "../schemas/evaluation.query.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller()
export class EvaluationController {
    constructor(
        @Inject(GetTaskEvaluationUseCase) private readonly getTaskEvaluation: GetTaskEvaluationUseCase,
        @Inject(ListBriefingsUseCase) private readonly listBriefings: ListBriefingsUseCase,
        @Inject(SearchSimilarWorkflowsUseCase) private readonly searchSimilarWorkflows: SearchSimilarWorkflowsUseCase,
        @Inject(GetWorkflowContentUseCase) private readonly getWorkflowContent: GetWorkflowContentUseCase,
        @Inject(ListEvaluationsUseCase) private readonly listEvaluations: ListEvaluationsUseCase,
        @Inject(SearchWorkflowLibraryUseCase) private readonly searchWorkflowLibrary: SearchWorkflowLibraryUseCase,
        @Inject(ListPlaybooksUseCase) private readonly listPlaybooks: ListPlaybooksUseCase,
        @Inject(GetPlaybookUseCase) private readonly getPlaybook: GetPlaybookUseCase,
    ) {}

    @Get("/api/tasks/:id/evaluate")
    async getEvaluation(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        const evaluation = await this.getTaskEvaluation.execute(taskId, scopeKey);
        return evaluation ?? null;
    }

    @Get("/api/tasks/:id/briefings")
    async listBriefingsEndpoint(@Param("id") taskId: string) {
        return this.listBriefings.execute(taskId);
    }

    @Get("/api/workflows/similar")
    async findSimilar(@Query(new ZodValidationPipe(similarWorkflowQuerySchema)) query: SimilarWorkflowQuery) {
        return this.searchSimilarWorkflows.execute(query.q, query.tags, query.limit);
    }

    @Get("/api/workflows/:id/content")
    async getWorkflowContentEndpoint(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        const content = await this.getWorkflowContent.execute(taskId, scopeKey);
        if (!content) throw new HttpException({ error: "workflow content not found" }, HttpStatus.NOT_FOUND);
        return content;
    }

    @Get("/api/workflows")
    async listWorkflows(@Query(new ZodValidationPipe(workflowListQuerySchema)) query: WorkflowListQuery) {
        if (query.q) return this.searchWorkflowLibrary.execute(query.q, query.rating, query.limit);
        return this.listEvaluations.execute(query.rating);
    }

    @Get("/api/playbooks")
    async listPlaybooksEndpoint(@Query(new ZodValidationPipe(playbookListQuerySchema)) query: PlaybookListQuery) {
        return this.listPlaybooks.execute(query.q, query.status, query.limit);
    }

    @Get("/api/playbooks/:id")
    async getPlaybookEndpoint(@Param("id") playbookId: string) {
        const playbook = await this.getPlaybook.execute(playbookId);
        if (!playbook) throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        return playbook;
    }
}
