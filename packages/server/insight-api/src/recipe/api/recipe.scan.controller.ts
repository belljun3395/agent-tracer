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
import { ListFileAffinityUseCase } from "../application/list.file.affinity.usecase.js";
import { ListRecipeApplicationsUseCase } from "../application/list.recipe.applications.usecase.js";
import { RetireRecipeUseCase } from "../application/retire.recipe.usecase.js";
import { EnqueueRecipeScanUseCase } from "../application/enqueue.recipe.scan.usecase.js";
import { GetLatestRecipeScanUseCase } from "../application/get.latest.recipe.scan.usecase.js";
import { MatchRecipeUseCase } from "../application/match.recipe.usecase.js";
import {
    MissingApiKeyError,
    NoTasksToScanError,
    RecipeScanAlreadyInFlightError,
} from "../service/recipe.scan.service.js";
import {
    RECIPE_SCAN_ARCHIVED_SCOPES,
    RECIPE_SCAN_STATUS_FILTERS,
} from "../domain/recipe.scan.filters.js";
import {
    parseRecipeCandidateStatusFilter,
    parseRecipeStatusFilter,
} from "./recipe.query.filters.js";

const enqueueBodySchema = z
    .object({
        statusFilter: z.enum(RECIPE_SCAN_STATUS_FILTERS).optional(),
        since: z.string().datetime({ offset: true }).optional(),
        maxCandidates: z.number().int().min(1).max(30).optional(),
        minEventCount: z.number().int().min(1).max(1000).optional(),
        archivedScope: z.enum(RECIPE_SCAN_ARCHIVED_SCOPES).optional(),
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
        private readonly enqueueScan: EnqueueRecipeScanUseCase,
        private readonly getLatestScan: GetLatestRecipeScanUseCase,
        private readonly matchRecipe: MatchRecipeUseCase,
        private readonly listCandidates: ListRecipeCandidatesUseCase,
        private readonly acceptCandidate: AcceptRecipeCandidateUseCase,
        private readonly dismissCandidate: DismissRecipeCandidateUseCase,
        private readonly listRecipes: ListRecipesUseCase,
        private readonly retireRecipe: RetireRecipeUseCase,
        private readonly listApplicationsUseCase: ListRecipeApplicationsUseCase,
        private readonly fileAffinityUseCase: ListFileAffinityUseCase,
    ) {}

    @Post("scan")
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(
        @Body(new ZodValidationPipe(enqueueBodySchema)) body: EnqueueDto,
    ) {
        try {
            return await this.enqueueScan.execute({
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
        return this.getLatestScan.execute();
    }

    @Get("candidates")
    async candidates(@Query("status") statusParam?: string) {
        return this.listCandidates.execute({
            status: parseRecipeCandidateStatusFilter(statusParam),
        });
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
        return this.listRecipes.execute({
            status: parseRecipeStatusFilter(statusParam),
        });
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
        return this.matchRecipe.execute({
            prompt: body.prompt,
            ...(body.taskId ? { targetTaskId: body.taskId } : {}),
            ...(body.limit !== undefined ? { limit: body.limit } : {}),
            ...(body.injectedVia ? { injectedVia: body.injectedVia } : {}),
            ...(body.dryRun !== undefined ? { dryRun: body.dryRun } : {}),
        });
    }

    @Get("file-affinity")
    async fileAffinityByIntent(
        @Query("intent") intent?: string,
        @Query("limit") limitParam?: string,
        @Query("path") pathParam?: string,
    ) {
        if (pathParam) {
            return this.fileAffinityUseCase.listIntentsForFile(pathParam);
        }
        if (!intent) {
            throw new BadRequestException("intent or path query param required");
        }
        const limit = clampSmallInt(limitParam, 10, 50);
        return this.fileAffinityUseCase.listByIntent(intent, limit);
    }

    @Get("applications")
    async listApplications(@Query("taskId") taskIdParam?: string) {
        if (!taskIdParam) {
            throw new BadRequestException("taskId query param required");
        }
        return this.listApplicationsUseCase.execute(taskIdParam);
    }
}
