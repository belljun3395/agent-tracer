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
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/tasks/:id")
export class TaskEvaluationWriteController {
    constructor(
        @Inject(UpsertTaskEvaluationUseCase) private readonly upsertTaskEvaluation: UpsertTaskEvaluationUseCase,
        @Inject(RecordBriefingCopyUseCase) private readonly recordBriefingCopy: RecordBriefingCopyUseCase,
        @Inject(SaveBriefingUseCase) private readonly saveBriefing: SaveBriefingUseCase,
    ) {}

    @Post("evaluate")
    @HttpCode(HttpStatus.OK)
    async upsertEvaluation(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
        @Body(new ZodValidationPipe(taskEvaluateSchema)) body: Parameters<UpsertTaskEvaluationUseCase["execute"]>[1],
    ) {
        const { rating, useCase, workflowTags, outcomeNote, approachNote, reuseWhen, watchouts, workflowSnapshot, workflowContext } = body;
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

    @Post("briefing/copied")
    @HttpCode(HttpStatus.OK)
    async recordBriefingCopyEndpoint(
        @Param("id") taskId: string,
        @Query("scopeKey") scopeKey: string | undefined,
    ) {
        await this.recordBriefingCopy.execute(taskId, scopeKey);
        return { ok: true };
    }

    @Post("briefings")
    @HttpCode(HttpStatus.OK)
    async saveBriefingEndpoint(
        @Param("id") taskId: string,
        @Body(new ZodValidationPipe(briefingSaveSchema)) body: Parameters<SaveBriefingUseCase["execute"]>[1],
    ) {
        return this.saveBriefing.execute(taskId, {
            purpose: body.purpose,
            format: body.format,
            content: body.content,
            generatedAt: body.generatedAt,
            ...(body.memo !== undefined ? { memo: body.memo } : {}),
        });
    }
}

@Controller("api/playbooks")
export class PlaybookWriteController {
    constructor(
        @Inject(CreatePlaybookUseCase) private readonly createPlaybook: CreatePlaybookUseCase,
        @Inject(UpdatePlaybookUseCase) private readonly updatePlaybook: UpdatePlaybookUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createPlaybookEndpoint(@Body(new ZodValidationPipe(playbookUpsertSchema)) body: PlaybookUpsertInput) {
        const payload: PlaybookUpsertInput = {
            title: body.title,
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.whenToUse !== undefined ? { whenToUse: body.whenToUse } : {}),
            ...(body.prerequisites !== undefined ? { prerequisites: body.prerequisites } : {}),
            ...(body.approach !== undefined ? { approach: body.approach } : {}),
            ...(body.keySteps !== undefined ? { keySteps: body.keySteps } : {}),
            ...(body.watchouts !== undefined ? { watchouts: body.watchouts } : {}),
            ...(body.antiPatterns !== undefined ? { antiPatterns: body.antiPatterns } : {}),
            ...(body.failureModes !== undefined ? { failureModes: body.failureModes } : {}),
            ...(body.variants !== undefined ? { variants: body.variants } : {}),
            ...(body.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: body.relatedPlaybookIds } : {}),
            ...(body.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: body.sourceSnapshotIds } : {}),
            ...(body.tags !== undefined ? { tags: body.tags } : {}),
        };
        return this.createPlaybook.execute(payload);
    }

    @Post(":id")
    @HttpCode(HttpStatus.OK)
    async updatePlaybookEndpoint(
        @Param("id") playbookId: string,
        @Body(new ZodValidationPipe(playbookPatchSchema)) body: Partial<PlaybookUpsertInput>,
    ) {
        const payload: Partial<PlaybookUpsertInput> = {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.whenToUse !== undefined ? { whenToUse: body.whenToUse } : {}),
            ...(body.prerequisites !== undefined ? { prerequisites: body.prerequisites } : {}),
            ...(body.approach !== undefined ? { approach: body.approach } : {}),
            ...(body.keySteps !== undefined ? { keySteps: body.keySteps } : {}),
            ...(body.watchouts !== undefined ? { watchouts: body.watchouts } : {}),
            ...(body.antiPatterns !== undefined ? { antiPatterns: body.antiPatterns } : {}),
            ...(body.failureModes !== undefined ? { failureModes: body.failureModes } : {}),
            ...(body.variants !== undefined ? { variants: body.variants } : {}),
            ...(body.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: body.relatedPlaybookIds } : {}),
            ...(body.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: body.sourceSnapshotIds } : {}),
            ...(body.tags !== undefined ? { tags: body.tags } : {}),
        };
        const updated = await this.updatePlaybook.execute(playbookId, payload);
        if (!updated) throw new HttpException({ error: "playbook not found" }, HttpStatus.NOT_FOUND);
        return updated;
    }
}
