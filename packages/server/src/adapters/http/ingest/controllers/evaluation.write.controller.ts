import { Body, Controller, HttpCode, HttpException, HttpStatus, Param, Post, Query, Inject } from "@nestjs/common";
import type { PlaybookUpsertInput } from "~application/index.js";
import {
    UpsertTaskEvaluationUseCase,
    RecordBriefingCopyUseCase,
    SaveBriefingUseCase,
    CreatePlaybookUseCase,
    UpdatePlaybookUseCase,
} from "~application/workflow/usecases.index.js";
import {
    briefingSaveSchema,
    playbookPatchSchema,
    playbookUpsertSchema,
    taskEvaluateSchema,
} from "../schemas/evaluation.write.schema.js";

@Controller()
export class EvaluationWriteController {
    constructor(
        @Inject(UpsertTaskEvaluationUseCase) private readonly upsertTaskEvaluation: UpsertTaskEvaluationUseCase,
        @Inject(RecordBriefingCopyUseCase) private readonly recordBriefingCopy: RecordBriefingCopyUseCase,
        @Inject(SaveBriefingUseCase) private readonly saveBriefing: SaveBriefingUseCase,
        @Inject(CreatePlaybookUseCase) private readonly createPlaybook: CreatePlaybookUseCase,
        @Inject(UpdatePlaybookUseCase) private readonly updatePlaybook: UpdatePlaybookUseCase,
    ) {}

    @Post("/api/tasks/:id/evaluate")
    @HttpCode(HttpStatus.OK)
    async upsertEvaluation(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
        @Body() body: unknown,
    ) {
        const parsed = taskEvaluateSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        const { rating, useCase, workflowTags, outcomeNote, approachNote, reuseWhen, watchouts, workflowSnapshot, workflowContext } = parsed.data;
        await this.upsertTaskEvaluation.execute(taskId, {
            ...(scopeKey ? { scopeKey } : {}),
            rating,
            ...(useCase !== undefined ? { useCase } : {}),
            ...(workflowTags !== undefined ? { workflowTags } : {}),
            ...(outcomeNote !== undefined ? { outcomeNote } : {}),
            ...(approachNote !== undefined ? { approachNote } : {}),
            ...(reuseWhen !== undefined ? { reuseWhen } : {}),
            ...(watchouts !== undefined ? { watchouts } : {}),
            ...(workflowSnapshot !== undefined ? { workflowSnapshot } : {}),
            ...(workflowContext !== undefined ? { workflowContext } : {}),
        });
        return { ok: true };
    }

    @Post("/api/tasks/:id/briefing/copied")
    @HttpCode(HttpStatus.OK)
    async recordBriefingCopyEndpoint(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        await this.recordBriefingCopy.execute(taskId, scopeKey);
        return { ok: true };
    }

    @Post("/api/tasks/:id/briefings")
    @HttpCode(HttpStatus.OK)
    async saveBriefingEndpoint(@Param("id") taskId: string, @Body() body: unknown) {
        const parsed = briefingSaveSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
        return this.saveBriefing.execute(taskId, {
            purpose: parsed.data.purpose,
            format: parsed.data.format,
            content: parsed.data.content,
            generatedAt: parsed.data.generatedAt,
            ...(parsed.data.memo !== undefined ? { memo: parsed.data.memo } : {}),
        });
    }

    @Post("/api/playbooks")
    @HttpCode(HttpStatus.OK)
    async createPlaybookEndpoint(@Body() body: unknown) {
        const parsed = playbookUpsertSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
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
        return this.createPlaybook.execute(payload);
    }

    @Post("/api/playbooks/:id")
    @HttpCode(HttpStatus.OK)
    async updatePlaybookEndpoint(@Param("id") playbookId: string, @Body() body: unknown) {
        const parsed = playbookPatchSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: "Validation failed", details: parsed.error.errors }, HttpStatus.BAD_REQUEST);
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
        const updated = await this.updatePlaybook.execute(playbookId, payload);
        if (!updated) throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        return updated;
    }
}
