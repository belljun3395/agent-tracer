import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, HttpCode } from "@nestjs/common";
import { TaskId } from "@monitor/core";
import type { Response } from "express";
import { Res } from "@nestjs/common";
import type { MonitorServiceProvider } from "../service/monitor-service.provider.js";
import { briefingSaveSchema, playbookPatchSchema, playbookUpsertSchema, taskEvaluateSchema } from "../schemas.js";
import type { PlaybookUpsertInput } from "../../application/ports";
@Controller()
export class EvaluationController {
    constructor(private readonly service: MonitorServiceProvider) { }
    @Post("/api/tasks/:id/evaluate")
    @HttpCode(HttpStatus.OK)
    async upsertEvaluation(
    @Param("id")
    taskId: string, 
    @Body()
    body: unknown) {
        const parsed = taskEvaluateSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        }
        const { rating, useCase, workflowTags, outcomeNote, approachNote, reuseWhen, watchouts, workflowSnapshot, workflowContext } = parsed.data;
        await this.service.upsertTaskEvaluation(TaskId(taskId), {
            rating,
            ...(useCase !== undefined ? { useCase } : {}),
            ...(workflowTags !== undefined ? { workflowTags } : {}),
            ...(outcomeNote !== undefined ? { outcomeNote } : {}),
            ...(approachNote !== undefined ? { approachNote } : {}),
            ...(reuseWhen !== undefined ? { reuseWhen } : {}),
            ...(watchouts !== undefined ? { watchouts } : {}),
            ...(workflowSnapshot !== undefined ? { workflowSnapshot } : {}),
            ...(workflowContext !== undefined ? { workflowContext } : {})
        });
        return { ok: true };
    }
    @Get("/api/tasks/:id/evaluate")
    async getEvaluation(
    @Param("id")
    taskId: string, 
    @Res()
    res: Response) {
        const evaluation = await this.service.getTaskEvaluation(TaskId(taskId));
        res.json(evaluation ?? null);
    }
    @Post("/api/tasks/:id/briefing/copied")
    @HttpCode(HttpStatus.OK)
    async recordBriefingCopy(
    @Param("id")
    taskId: string) {
        await this.service.recordBriefingCopy(TaskId(taskId));
        return { ok: true };
    }
    @Post("/api/tasks/:id/briefings")
    @HttpCode(HttpStatus.OK)
    async saveBriefing(
    @Param("id")
    taskId: string,
    @Body()
    body: unknown) {
        const parsed = briefingSaveSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        }
        return this.service.saveBriefing(TaskId(taskId), {
            purpose: parsed.data.purpose,
            format: parsed.data.format,
            content: parsed.data.content,
            generatedAt: parsed.data.generatedAt,
            ...(parsed.data.memo !== undefined ? { memo: parsed.data.memo } : {})
        });
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
    taskId: string) {
        const content = await this.service.getWorkflowContent(TaskId(taskId));
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
    @Post("/api/playbooks")
    @HttpCode(HttpStatus.OK)
    async createPlaybook(
    @Body()
    body: unknown) {
        const parsed = playbookUpsertSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        }
        const payload: PlaybookUpsertInput = {
            title: parsed.data.title,
            ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
            ...(parsed.data.whenToUse !== undefined ? { whenToUse: parsed.data.whenToUse } : {}),
            ...(parsed.data.prerequisites !== undefined ? { prerequisites: parsed.data.prerequisites } : {}),
            ...(parsed.data.approach !== undefined ? { approach: parsed.data.approach } : {}),
            ...(parsed.data.keySteps !== undefined ? { keySteps: parsed.data.keySteps } : {}),
            ...(parsed.data.watchouts !== undefined ? { watchouts: parsed.data.watchouts } : {}),
            ...(parsed.data.antiPatterns !== undefined ? { antiPatterns: parsed.data.antiPatterns } : {}),
            ...(parsed.data.failureModes !== undefined ? { failureModes: parsed.data.failureModes } : {}),
            ...(parsed.data.variants !== undefined ? { variants: parsed.data.variants } : {}),
            ...(parsed.data.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: parsed.data.relatedPlaybookIds } : {}),
            ...(parsed.data.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: parsed.data.sourceSnapshotIds } : {}),
            ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        };
        return this.service.createPlaybook(payload);
    }
    @Post("/api/playbooks/:id")
    @HttpCode(HttpStatus.OK)
    async updatePlaybook(
    @Param("id")
    playbookId: string,
    @Body()
    body: unknown) {
        const parsed = playbookPatchSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        }
        const payload: Partial<PlaybookUpsertInput> = {
            ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
            ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
            ...(parsed.data.whenToUse !== undefined ? { whenToUse: parsed.data.whenToUse } : {}),
            ...(parsed.data.prerequisites !== undefined ? { prerequisites: parsed.data.prerequisites } : {}),
            ...(parsed.data.approach !== undefined ? { approach: parsed.data.approach } : {}),
            ...(parsed.data.keySteps !== undefined ? { keySteps: parsed.data.keySteps } : {}),
            ...(parsed.data.watchouts !== undefined ? { watchouts: parsed.data.watchouts } : {}),
            ...(parsed.data.antiPatterns !== undefined ? { antiPatterns: parsed.data.antiPatterns } : {}),
            ...(parsed.data.failureModes !== undefined ? { failureModes: parsed.data.failureModes } : {}),
            ...(parsed.data.variants !== undefined ? { variants: parsed.data.variants } : {}),
            ...(parsed.data.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: parsed.data.relatedPlaybookIds } : {}),
            ...(parsed.data.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: parsed.data.sourceSnapshotIds } : {}),
            ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        };
        const updated = await this.service.updatePlaybook(playbookId, payload);
        if (!updated) {
            throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        }
        return updated;
    }
}
