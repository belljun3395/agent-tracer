import { Controller, Get, HttpException, HttpStatus, Param, Query, Res, Inject } from "@nestjs/common";
import type { Response } from "express";
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
        @Res() res: Response,
    ) {
        const evaluation = await this.getTaskEvaluation.execute(taskId, scopeKey);
        res.json(evaluation ?? null);
    }

    @Get("/api/tasks/:id/briefings")
    async listBriefingsEndpoint(@Param("id") taskId: string) {
        return this.listBriefings.execute(taskId);
    }

    @Get("/api/workflows/similar")
    async findSimilar(
        @Query("q") q?: string,
        @Query("tags") tagsRaw?: string,
        @Query("limit") limitRaw?: string,
    ) {
        const query = typeof q === "string" ? q.trim() : "";
        if (!query) throw new HttpException({ error: "q parameter is required" }, HttpStatus.BAD_REQUEST);
        const tags = typeof tagsRaw === "string" && tagsRaw
            ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean)
            : undefined;
        const limit = typeof limitRaw === "string"
            ? Math.min(Number.parseInt(limitRaw, 10) || 5, 10)
            : 5;
        return this.searchSimilarWorkflows.execute(query, tags, limit);
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
    async listWorkflows(
        @Query("rating") ratingRaw?: string,
        @Query("q") q?: string,
        @Query("limit") limitRaw?: string,
    ) {
        const rating = ratingRaw === "good" || ratingRaw === "skip" ? ratingRaw : undefined;
        const query = typeof q === "string" ? q.trim() : "";
        const limit = typeof limitRaw === "string"
            ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 100)
            : 50;
        if (query) return this.searchWorkflowLibrary.execute(query, rating, limit);
        return this.listEvaluations.execute(rating);
    }

    @Get("/api/playbooks")
    async listPlaybooksEndpoint(
        @Query("q") q?: string,
        @Query("status") statusRaw?: string,
        @Query("limit") limitRaw?: string,
    ) {
        const query = typeof q === "string" ? q.trim() : "";
        const status = statusRaw === "draft" || statusRaw === "active" || statusRaw === "archived" ? statusRaw : undefined;
        const limit = typeof limitRaw === "string"
            ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 100)
            : 50;
        return this.listPlaybooks.execute(query || undefined, status, limit);
    }

    @Get("/api/playbooks/:id")
    async getPlaybookEndpoint(@Param("id") playbookId: string) {
        const playbook = await this.getPlaybook.execute(playbookId);
        if (!playbook) throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        return playbook;
    }
}
