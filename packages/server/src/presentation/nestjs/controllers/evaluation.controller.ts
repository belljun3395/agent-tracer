/**
 * @module nestjs/controllers/evaluation.controller
 *
 * Task evaluation and workflow library endpoints.
 */
import {
  Controller, Get, Post,
  Body, Param, Query, HttpException, HttpStatus, HttpCode
} from "@nestjs/common";
import type { Response } from "express";
import { Res } from "@nestjs/common";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";
import { taskEvaluateSchema } from "../../schemas.js";

@Controller()
export class EvaluationController {
  constructor(private readonly service: MonitorServiceProvider) {}

  @Post("/api/tasks/:id/evaluate")
  @HttpCode(HttpStatus.OK)
  async upsertEvaluation(@Param("id") taskId: string, @Body() body: unknown) {
    const parsed = taskEvaluateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: "Validation failed", details: parsed.error.errors },
        HttpStatus.BAD_REQUEST
      );
    }
    const {
      rating,
      useCase,
      workflowTags,
      outcomeNote,
      approachNote,
      reuseWhen,
      watchouts,
      workflowSnapshot,
      workflowContext
    } = parsed.data;

    await this.service.upsertTaskEvaluation(taskId, {
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
  async getEvaluation(@Param("id") taskId: string, @Res() res: Response) {
    const evaluation = await this.service.getTaskEvaluation(taskId);
    // NestJS 기본 직렬화는 null을 {} 로 변환하므로 명시적으로 JSON 응답을 반환한다.
    res.json(evaluation ?? null);
  }

  // /api/workflows/similar MUST be registered before /api/workflows/:id/content
  @Get("/api/workflows/similar")
  async findSimilar(
    @Query("q") q?: string,
    @Query("tags") tagsRaw?: string,
    @Query("limit") limitRaw?: string
  ) {
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
  async getWorkflowContent(@Param("id") taskId: string) {
    const content = await this.service.getWorkflowContent(taskId);
    if (!content) {
      throw new HttpException({ error: "workflow content not found" }, HttpStatus.NOT_FOUND);
    }
    return content;
  }

  @Get("/api/workflows")
  async listWorkflows(
    @Query("rating") ratingRaw?: string,
    @Query("q") q?: string,
    @Query("limit") limitRaw?: string
  ) {
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
}
