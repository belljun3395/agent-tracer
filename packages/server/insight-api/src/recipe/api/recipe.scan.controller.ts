import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Query,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { AcceptRecipeCandidateUseCase } from "../application/accept.recipe.candidate.usecase.js";
import { DismissRecipeCandidateUseCase } from "../application/dismiss.recipe.candidate.usecase.js";
import { ListRecipeCandidatesUseCase } from "../application/list.recipe.candidates.usecase.js";
import { ListRecipesUseCase } from "../application/list.recipes.usecase.js";
import { RecipeMatchingService } from "../application/recipe.matching.service.js";
import { FileAffinityRepository } from "../repository/file.affinity.repository.js";
import { RecipeApplicationRepository } from "../repository/recipe.application.repository.js";
import { RetireRecipeUseCase } from "../application/retire.recipe.usecase.js";
import {
    MissingApiKeyError,
    NoTasksToScanError,
    RecipeScanAlreadyInFlightError,
    RecipeScanService,
} from "../application/recipe.scan.service.js";
import type { RecipeCandidateStatusFilter } from "../application/dto/recipe.usecase.dto.js";

const enqueueBodySchema = z
    .object({
        statusFilter: z.enum(["completed", "active", "all"]).optional(),
        since: z.string().datetime({ offset: true }).optional(),
        maxCandidates: z.number().int().min(1).max(30).optional(),
        minEventCount: z.number().int().min(1).max(1000).optional(),
        archivedScope: z.enum(["active", "archived", "all"]).optional(),
    })
    .strict();

class EnqueueDto extends createZodDto(enqueueBodySchema) {}

const matchBodySchema = z
    .object({
        prompt: z.string().trim().min(1),
        taskId: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(10).optional(),
        injectedVia: z.enum(["auto", "slash_command", "manual"]).optional(),
        dryRun: z.boolean().optional(),
    })
    .strict();

class MatchDto extends createZodDto(matchBodySchema) {}

function clampSmallInt(
    raw: string | undefined,
    fallback: number,
    max: number,
): number {
    if (raw === undefined) return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, max);
}

@Controller("api/v1/recipes")
export class RecipeScanController {
    constructor(
        private readonly service: RecipeScanService,
        private readonly listCandidates: ListRecipeCandidatesUseCase,
        private readonly acceptCandidate: AcceptRecipeCandidateUseCase,
        private readonly dismissCandidate: DismissRecipeCandidateUseCase,
        private readonly listRecipes: ListRecipesUseCase,
        private readonly retireRecipe: RetireRecipeUseCase,
        private readonly matching: RecipeMatchingService,
        private readonly applications: RecipeApplicationRepository,
        private readonly fileAffinity: FileAffinityRepository,
    ) {}

    @Post("scan")
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(
        @Body(new ZodValidationPipe(enqueueBodySchema)) body: EnqueueDto,
    ) {
        try {
            const job = await this.service.run({
                ...(body.statusFilter ? { statusFilter: body.statusFilter } : {}),
                ...(body.since ? { since: body.since } : {}),
                ...(body.maxCandidates !== undefined
                    ? { maxCandidates: body.maxCandidates }
                    : {}),
                ...(body.minEventCount !== undefined
                    ? { minEventCount: body.minEventCount }
                    : {}),
                ...(body.archivedScope ? { archivedScope: body.archivedScope } : {}),
            });
            return {
                jobId: job.id,
                status: job.status,
                createdAt: job.createdAt,
            };
        } catch (err) {
            if (err instanceof RecipeScanAlreadyInFlightError) {
                throw new ConflictException({
                    message: err.message,
                    jobId: err.jobId,
                });
            }
            if (err instanceof MissingApiKeyError) {
                throw new BadRequestException(err.message);
            }
            if (err instanceof NoTasksToScanError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Get("scan/jobs/latest")
    async latest() {
        const job = await this.service.findLatest();
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                candidatesCreated: job.candidatesCreated ?? 0,
                tasksScanned: job.tasksScanned ?? 0,
                language: job.language,
                modelUsed: job.modelUsed,
                durationMs: job.durationMs,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            },
        };
    }

    @Get("candidates")
    async candidates(@Query("status") statusParam?: string) {
        let status: RecipeCandidateStatusFilter = "pending";
        if (statusParam !== undefined) {
            if (statusParam !== "pending" && statusParam !== "all") {
                throw new BadRequestException("status must be 'pending' or 'all'");
            }
            status = statusParam;
        }
        return this.listCandidates.execute({ status });
    }

    @Post("candidates/:candidateId/accept")
    @HttpCode(HttpStatus.OK)
    async accept(
        @Param("candidateId", pathParamPipe) candidateId: string,
    ) {
        const result = await this.acceptCandidate.execute({ candidateId });
        if (result.status === "not_found") {
            throw new NotFoundException("Recipe candidate not found");
        }
        if (result.status === "not_pending") {
            throw new ConflictException("Candidate is no longer pending");
        }
        return { status: result.status, recipeId: result.recipeId };
    }

    @Post("candidates/:candidateId/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismiss(
        @Param("candidateId", pathParamPipe) candidateId: string,
    ) {
        const result = await this.dismissCandidate.execute({ candidateId });
        if (result.status === "not_found") {
            throw new NotFoundException("Recipe candidate not found");
        }
        if (result.status === "not_pending") {
            throw new ConflictException("Candidate is no longer pending");
        }
        return { status: result.status };
    }

    @Get()
    async list(@Query("status") statusParam?: string) {
        let status: "active" | "superseded" | "retired" | "all" = "active";
        if (statusParam !== undefined) {
            if (
                statusParam !== "active" &&
                statusParam !== "superseded" &&
                statusParam !== "retired" &&
                statusParam !== "all"
            ) {
                throw new BadRequestException(
                    "status must be 'active', 'superseded', 'retired', or 'all'",
                );
            }
            status = statusParam;
        }
        return this.listRecipes.execute({ status });
    }

    @Delete(":recipeId")
    @HttpCode(HttpStatus.OK)
    async retire(
        @Param("recipeId", pathParamPipe) recipeId: string,
    ) {
        const result = await this.retireRecipe.execute({ recipeId });
        if (result.status === "not_found") {
            throw new NotFoundException("Recipe not found");
        }
        return { status: result.status };
    }

    @Post("match")
    @HttpCode(HttpStatus.OK)
    async match(
        @Body(new ZodValidationPipe(matchBodySchema)) body: MatchDto,
    ) {
        const matches = await this.matching.match({
            prompt: body.prompt,
            ...(body.taskId ? { targetTaskId: body.taskId } : {}),
            ...(body.limit !== undefined ? { limit: body.limit } : {}),
            ...(body.injectedVia ? { injectedVia: body.injectedVia } : {}),
            ...(body.dryRun !== undefined ? { dryRun: body.dryRun } : {}),
        });
        return { matches };
    }

    @Get("file-affinity")
    async fileAffinityByIntent(
        @Query("intent") intent?: string,
        @Query("limit") limitParam?: string,
        @Query("path") pathParam?: string,
    ) {
        if (pathParam) {
            const rows = await this.fileAffinity.listIntentsForFile(pathParam);
            return {
                file: pathParam,
                intents: rows.map((r) => ({
                    intentLabel: r.intentLabel,
                    role: r.role,
                    openCount: r.openCount,
                    lastSeenAt: r.lastSeenAt,
                })),
            };
        }
        if (!intent) {
            throw new BadRequestException("intent or path query param required");
        }
        const limit = clampSmallInt(limitParam, 10, 50);
        const rows = await this.fileAffinity.listByIntent(intent, limit);
        return {
            intent,
            files: rows.map((r) => ({
                filePath: r.filePath,
                role: r.role,
                openCount: r.openCount,
                lastSeenAt: r.lastSeenAt,
            })),
        };
    }

    @Get("applications")
    async listApplications(@Query("taskId") taskIdParam?: string) {
        if (!taskIdParam) {
            throw new BadRequestException("taskId query param required");
        }
        const rows = await this.applications.listByTaskId(taskIdParam);
        return {
            applications: rows.map((r) => ({
                id: r.id,
                recipeId: r.recipeId,
                targetTaskId: r.targetTaskId,
                injectedVia: r.injectedVia,
                score: r.score,
                outcome: r.outcome,
                createdAt: r.createdAt,
                resolvedAt: r.resolvedAt,
            })),
        };
    }
}
