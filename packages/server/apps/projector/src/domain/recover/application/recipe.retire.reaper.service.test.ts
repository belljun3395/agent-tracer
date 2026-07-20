import { describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "@monitor/kernel";
import {
    RecipeApplicationEntity,
    RecipeApplicationRepository,
    RecipeEntity,
    RecipeRepository,
    type RecipeCandidateInput,
} from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import { RecipeRetireReaperService } from "~projector/domain/recover/application/recipe.retire.reaper.service.js";
import { InMemoryAdvisoryLock } from "~projector/domain/recover/port/__fakes__/in-memory.advisory.lock.js";
import type { RecipeRetireReaperRepositories } from "~projector/domain/recover/port/recipe.retire.reaper.repository.port.js";

const NOW = new Date("2026-07-20T00:00:00.000Z");
const STALE_CREATED_AT = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);

function candidateInput(id: string): RecipeCandidateInput {
    return {
        id,
        userId: "u1",
        title: "제목",
        intent: "intent",
        description: "설명",
        summaryMd: "요약",
        request: "사용자가 작업 절차를 recipe로 만들라고 했다.",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [],
        touchedFiles: [],
        contributingSlices: [],
    };
}

function makeRecipe(id: string, createdAt: Date): RecipeEntity {
    const recipe = RecipeEntity.candidate(candidateInput(id), createdAt);
    recipe.accept(createdAt);
    return recipe;
}

function makeApplication(recipeId: string): RecipeApplicationEntity {
    const application = new RecipeApplicationEntity();
    application.id = `app-${recipeId}`;
    application.userId = "u1";
    application.recipeId = recipeId;
    application.taskId = "task-1";
    application.injectedVia = "pull";
    application.outcome = null;
    application.note = null;
    application.anchorEventId = "event-1";
    application.anchorSeq = "1";
    application.createdAt = STALE_CREATED_AT;
    return application;
}

function makeService(
    recipes: readonly RecipeEntity[],
    applications: readonly RecipeApplicationEntity[] = [],
    options: { readonly lockHeld?: boolean } = {},
): { readonly service: RecipeRetireReaperService; readonly recipeRepo: RecipeRepository } {
    const recipeStore = createInMemoryRepository<RecipeEntity>();
    recipeStore.seed(...recipes);
    const recipeRepo = new RecipeRepository(asRepository(recipeStore));

    const applicationStore = createInMemoryRepository<RecipeApplicationEntity>();
    applicationStore.seed(...applications);
    const applicationRepo = new RecipeApplicationRepository(asRepository(applicationStore));

    const scope: RecipeRetireReaperRepositories = { recipes: recipeRepo, recipeApplications: applicationRepo };
    const lock = new InMemoryAdvisoryLock(scope, options.lockHeld !== true);
    return { service: new RecipeRetireReaperService(lock), recipeRepo };
}

describe("RecipeRetireReaperService", () => {
    it("한 번도 당겨지지 않고 노후 임계값을 넘긴 active 레시피를 은퇴시킨다", async () => {
        const { service, recipeRepo } = makeService([makeRecipe("r1", STALE_CREATED_AT)]);

        const retired = await service.runOnce(NOW);

        expect(retired).toBe(1);
        expect((await recipeRepo.findById("r1"))?.status).toBe(RECIPE_STATUS.retired);
    });

    it("당겨진 적이 있으면 오래됐어도 은퇴시키지 않는다", async () => {
        const { service, recipeRepo } = makeService(
            [makeRecipe("r1", STALE_CREATED_AT)],
            [makeApplication("r1")],
        );

        const retired = await service.runOnce(NOW);

        expect(retired).toBe(0);
        expect((await recipeRepo.findById("r1"))?.status).toBe(RECIPE_STATUS.active);
    });

    it("아직 노후 임계값을 넘기지 않았으면 은퇴시키지 않는다", async () => {
        const { service, recipeRepo } = makeService([makeRecipe("r1", NOW)]);

        const retired = await service.runOnce(NOW);

        expect(retired).toBe(0);
        expect((await recipeRepo.findById("r1"))?.status).toBe(RECIPE_STATUS.active);
    });

    it("다른 러너가 락을 쥐고 있으면 아무것도 은퇴시키지 않는다", async () => {
        const { service, recipeRepo } = makeService([makeRecipe("r1", STALE_CREATED_AT)], [], { lockHeld: true });

        const retired = await service.runOnce(NOW);

        expect(retired).toBe(0);
        expect((await recipeRepo.findById("r1"))?.status).toBe(RECIPE_STATUS.active);
    });
});
