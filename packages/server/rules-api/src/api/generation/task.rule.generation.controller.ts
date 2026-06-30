import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Query,
    Post,
    Get,
} from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import {
    GenerationAlreadyInFlightError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../../domain/generation/task.rule.generation.errors.js";
import { EnqueueTaskRuleGenerationUseCase } from "../../application/generation/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "../../application/generation/get.latest.task.rule.generation.usecase.js";
import { ReportRuleProposalsUseCase, type RuleProposalInput } from "../../application/generation/report.rule.proposals.usecase.js";
import { FailRuleGenerationUseCase } from "../../application/generation/fail.rule.generation.usecase.js";

const ruleProposalSchema = z.object({
    name: z.string(),
    trigger: z.object({ phrases: z.array(z.string()) }).optional(),
    triggerOn: z.enum(["user", "assistant"]).optional(),
    expect: z.object({
        action: z.enum(["command", "file-read", "file-write", "web"]).optional(),
        commandMatches: z.array(z.string()).optional(),
        pattern: z.string().optional(),
    }),
    rationale: z.string(),
});

const proposalsBodySchema = z.object({
    rules: z.array(ruleProposalSchema),
    modelUsed: z.string(),
    durationMs: z.number(),
    costUsd: z.number().nullable().optional(),
    numTurns: z.number().nullable().optional(),
    usage: z.object({
        inputTokens: z.number(),
        outputTokens: z.number(),
        cacheReadTokens: z.number(),
        cacheCreationTokens: z.number(),
    }).nullable().optional(),
});

const failBodySchema = z.object({ error: z.string() });

@Controller("api/v1/rules/generate")
export class TaskRuleGenerationController {
    constructor(
        private readonly enqueueGeneration: EnqueueTaskRuleGenerationUseCase,
        private readonly getLatestGeneration: GetLatestTaskRuleGenerationUseCase,
        private readonly reportProposals: ReportRuleProposalsUseCase,
        private readonly failGeneration: FailRuleGenerationUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(@Query("taskId", pathParamPipe) taskId: string) {
        try {
            return await this.enqueueGeneration.execute(taskId);
        } catch (err) {
            if (err instanceof TaskNotFoundForGenerationError) {
                throw new NotFoundException(err.message);
            }
            if (err instanceof TaskHasNoEventsError) {
                throw new BadRequestException(err.message);
            }
            if (err instanceof GenerationAlreadyInFlightError) {
                throw new ConflictException({ message: err.message, jobId: err.jobId });
            }
            throw err;
        }
    }

    @Post(":jobId/proposals")
    @HttpCode(HttpStatus.OK)
    async submitProposals(
        @Param("jobId", pathParamPipe) jobId: string,
        @Body(new ZodValidationPipe(proposalsBodySchema)) body: z.infer<typeof proposalsBodySchema>,
    ) {
        return this.reportProposals.execute({
            jobId,
            rules: body.rules.map((r) => ({
                name: r.name,
                rationale: r.rationale,
                expect: {
                    ...(r.expect.action !== undefined ? { action: r.expect.action } : {}),
                    ...(r.expect.commandMatches !== undefined ? { commandMatches: r.expect.commandMatches } : {}),
                    ...(r.expect.pattern !== undefined ? { pattern: r.expect.pattern } : {}),
                },
                ...(r.trigger ? { trigger: r.trigger } : {}),
                ...(r.triggerOn ? { triggerOn: r.triggerOn } : {}),
            })) as RuleProposalInput[],
            modelUsed: body.modelUsed,
            durationMs: body.durationMs,
            ...(body.costUsd !== undefined ? { costUsd: body.costUsd } : {}),
            ...(body.numTurns !== undefined ? { numTurns: body.numTurns } : {}),
            ...(body.usage !== undefined ? { usage: body.usage } : {}),
        });
    }

    @Post(":jobId/fail")
    @HttpCode(HttpStatus.OK)
    async submitFailure(
        @Param("jobId", pathParamPipe) jobId: string,
        @Body(new ZodValidationPipe(failBodySchema)) body: z.infer<typeof failBodySchema>,
    ) {
        await this.failGeneration.execute(jobId, body.error);
    }

    @Get("latest")
    async latest(@Query("taskId", pathParamPipe) taskId: string) {
        return this.getLatestGeneration.execute(taskId);
    }
}
