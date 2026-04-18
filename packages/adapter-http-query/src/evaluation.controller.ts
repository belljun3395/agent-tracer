import { Controller, Get, HttpException, HttpStatus, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { TaskId } from "@monitor/domain";
import { MonitorService } from "@monitor/application";

@Controller()
export class EvaluationController {
    constructor(private readonly service: MonitorService) { }

    @Get("/api/tasks/:id/evaluate")
    async getEvaluation(
    @Param("id")
    taskId: string,
    @Query("scopeKey")
    scopeKey: string | undefined,
    @Res()
    res: Response) {
        const evaluation = await this.service.getTaskEvaluation(TaskId(taskId), scopeKey);
        res.json(evaluation ?? null);
    }

    @Get("/api/tasks/:id/briefings")
    async listBriefings(
    @Param("id")
    taskId: string) {
        return this.service.listBriefings(TaskId(taskId));
    }

    @Get("/api/workflows/similar")
    async findSimilar(
    @Query("q")
    q?: string,
    @Query("tags")
    tagsRaw?: string,
    @Query("limit")
    limitRaw?: string) {
        const query = typeof q === "string" ? q.trim() : "";
        if (!query) {
            throw new HttpException({ error: "q parameter is required" }, HttpStatus.BAD_REQUEST);
        }
        const tags = typeof tagsRaw === "string" && tagsRaw
            ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean)
            : undefined;
        const limit = typeof limitRaw === "string"
            ? Math.min(Number.parseInt(limitRaw, 10) || 5, 10)
            : 5;
        return this.service.searchSimilarWorkflows(query, tags, limit);
    }

    @Get("/api/workflows/:id/content")
    async getWorkflowContent(
    @Param("id")
    taskId: string,
    @Query("scopeKey")
    scopeKey: string | undefined) {
        const content = await this.service.getWorkflowContent(TaskId(taskId), scopeKey);
        if (!content) {
            throw new HttpException({ error: "workflow content not found" }, HttpStatus.NOT_FOUND);
        }
        return content;
    }

    @Get("/api/workflows")
    async listWorkflows(
    @Query("rating")
    ratingRaw?: string,
    @Query("q")
    q?: string,
    @Query("limit")
    limitRaw?: string) {
        const rating = ratingRaw === "good" || ratingRaw === "skip" ? ratingRaw : undefined;
        const query = typeof q === "string" ? q.trim() : "";
        const limit = typeof limitRaw === "string"
            ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 100)
            : 50;
        if (query) {
            return this.service.searchWorkflowLibrary(query, rating, limit);
        }
        return this.service.listEvaluations(rating);
    }

    @Get("/api/playbooks")
    async listPlaybooks(
    @Query("q")
    q?: string,
    @Query("status")
    statusRaw?: string,
    @Query("limit")
    limitRaw?: string) {
        const query = typeof q === "string" ? q.trim() : "";
        const status = statusRaw === "draft" || statusRaw === "active" || statusRaw === "archived" ? statusRaw : undefined;
        const limit = typeof limitRaw === "string"
            ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 50, 1), 100)
            : 50;
        return this.service.listPlaybooks(query || undefined, status, limit);
    }

    @Get("/api/playbooks/:id")
    async getPlaybook(
    @Param("id")
    playbookId: string) {
        const playbook = await this.service.getPlaybook(playbookId);
        if (!playbook) {
            throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        }
        return playbook;
    }
}
