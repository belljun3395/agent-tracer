import { describe, expect, it } from "vitest";
import { AGENT_TRACER_ATTR, KIND, RECIPE_STATUS, RECIPE_VERDICT } from "@monitor/kernel";
import {
    EventEntity,
    EventRepository,
    RecipeApplicationEntity,
    RecipeApplicationRepository,
    RecipeEntity,
    RecipeRepository,
    type RecipeCandidateInput,
} from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import type { RecipeProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RecipeProjection } from "./recipe.projection.js";

function makeRepositories() {
    const recipesFake = createInMemoryRepository<RecipeEntity>();
    const applicationsFake = createInMemoryRepository<RecipeApplicationEntity>();
    const eventsFake = createInMemoryRepository<EventEntity>();
    const repositories: RecipeProjectionRepositories = {
        recipes: new RecipeRepository(asRepository(recipesFake)),
        recipeApplications: new RecipeApplicationRepository(asRepository(applicationsFake)),
        events: new EventRepository(asRepository(eventsFake)),
    };
    return { repositories, recipesFake, applicationsFake, eventsFake };
}

function candidateInput(id: string, steps: RecipeCandidateInput["steps"] = []): RecipeCandidateInput {
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
        steps,
        touchedFiles: [],
        contributingSlices: [],
    };
}

function makeRecipe(id: string, steps: RecipeCandidateInput["steps"] = []): RecipeEntity {
    const recipe = RecipeEntity.candidate(candidateInput(id, steps), new Date("2026-01-01T00:00:00.000Z"));
    recipe.accept(new Date("2026-01-01T00:00:00.000Z"));
    return recipe;
}

function makeRecord(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
    return {
        id: "event-1",
        seq: "5",
        userId: "u1",
        taskId: "task-1",
        sessionId: null,
        kind: KIND.recipeInjected,
        occurredAt: new Date("2026-01-01T00:01:00.000Z"),
        receivedAt: new Date("2026-01-01T00:01:00.000Z"),
        traceId: "trace-1",
        spanId: "span-1",
        parentSpanId: null,
        payload: { recipeId: "r1", applicationId: "app-1", injectedVia: "pull" },
        ...overrides,
    };
}

function makeOpenApplication(overrides: Partial<RecipeApplicationEntity> = {}): RecipeApplicationEntity {
    const application = new RecipeApplicationEntity();
    application.id = overrides.id ?? "app-1";
    application.userId = "u1";
    application.recipeId = overrides.recipeId ?? "r1";
    application.taskId = overrides.taskId ?? "task-1";
    application.injectedVia = "pull";
    application.outcome = overrides.outcome ?? null;
    application.note = null;
    application.anchorEventId = overrides.anchorEventId ?? "event-1";
    application.anchorSeq = overrides.anchorSeq === undefined ? "5" : overrides.anchorSeq;
    application.verdict = null;
    application.verdictEvidence = null;
    application.createdAt = new Date("2026-01-01T00:01:00.000Z");
    application.resolvedAt = null;
    return application;
}

function makeResolvedApplication(overrides: Partial<RecipeApplicationEntity> & { readonly id: string }): RecipeApplicationEntity {
    const application = makeOpenApplication(overrides);
    application.verdict = overrides.verdict ?? RECIPE_VERDICT.abandoned;
    application.resolvedAt = new Date("2026-01-01T00:00:00.000Z");
    return application;
}

describe("RecipeProjection.projectInjected", () => {
    it("주입 이벤트를 앵커와 함께 새 적용 이력으로 연다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        const projection = new RecipeProjection();

        await projection.projectInjected(repositories, makeRecord());

        const saved = applicationsFake.all()[0];
        expect(saved).toMatchObject({ id: "app-1", recipeId: "r1", anchorEventId: "event-1", anchorSeq: "5", verdict: null });
    });

    it("같은 태스크·레시피에 이미 열린 적용이 있으면 새로 열지 않는다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        applicationsFake.seed(makeOpenApplication({ id: "existing" }));
        const projection = new RecipeProjection();

        await projection.projectInjected(repositories, makeRecord({ payload: { recipeId: "r1", applicationId: "app-2" } }));

        expect(applicationsFake.all().map((a) => a.id)).toEqual(["existing"]);
    });
});

describe("RecipeProjection.resolveForTask", () => {
    it("창에서 이행 증거를 관측해 followed_and_helped로 종결한다", async () => {
        const { repositories, recipesFake, applicationsFake, eventsFake } = makeRepositories();
        recipesFake.seed(makeRecipe("r1", [{ order: 1, action: "명령을 돌린다", verify: { kind: "command", commandMatches: ["npm test"] } }]));
        applicationsFake.seed(makeOpenApplication());
        const toolEvent = new EventEntity();
        Object.assign(toolEvent, {
            id: "e2",
            seq: "6",
            userId: "u1",
            taskId: "task-1",
            sessionId: null,
            turnId: null,
            kind: KIND.executeTool,
            lane: "implementation",
            title: "Bash",
            body: null,
            toolName: "Bash",
            filePaths: [],
            metadata: { [AGENT_TRACER_ATTR.command]: "npm test" },
            traceId: "trace-1",
            spanId: "span-2",
            parentSpanId: null,
            occurredAt: new Date("2026-01-01T00:02:00.000Z"),
        });
        eventsFake.seed(toolEvent);
        const projection = new RecipeProjection();

        await projection.resolveForTask(repositories, "task-1", "completed", new Date("2026-01-01T00:03:00.000Z"));

        const saved = applicationsFake.all()[0];
        expect(saved?.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
        expect(saved?.verdictEvidence?.source).toBe("observed");
    });

    it("앵커가 없는 이력은 자기보고를 폴백 근거로 판정한다", async () => {
        const { repositories, recipesFake, applicationsFake } = makeRepositories();
        recipesFake.seed(makeRecipe("r1", []));
        applicationsFake.seed(makeOpenApplication({ anchorEventId: null, anchorSeq: null, outcome: "completed" }));
        const projection = new RecipeProjection();

        await projection.resolveForTask(repositories, "task-1", "completed", new Date("2026-01-01T00:03:00.000Z"));

        const saved = applicationsFake.all()[0];
        expect(saved?.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
        expect(saved?.verdictEvidence?.source).toBe("self-report");
    });

    it("열린 적용이 없으면 아무것도 하지 않는다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        const projection = new RecipeProjection();

        await projection.resolveForTask(repositories, "task-1", "completed", new Date("2026-01-01T00:03:00.000Z"));

        expect(applicationsFake.all()).toEqual([]);
    });

    it("종결 판정이 실패 임계값을 넘기면 판정 갱신과 함께 레시피를 은퇴시킨다", async () => {
        const { repositories, recipesFake, applicationsFake } = makeRepositories();
        recipesFake.seed(
            makeRecipe("r1", [{ order: 1, action: "명령을 돌린다", verify: { kind: "command", commandMatches: ["npm test"] } }]),
        );
        for (let i = 0; i < 4; i += 1) {
            applicationsFake.seed(makeResolvedApplication({ id: `closed-${i}`, taskId: `task-old-${i}` }));
        }
        applicationsFake.seed(makeOpenApplication());
        const projection = new RecipeProjection();

        await projection.resolveForTask(repositories, "task-1", "completed", new Date("2026-01-01T00:03:00.000Z"));

        const recipe = recipesFake.all().find((r) => r.id === "r1");
        expect(recipe?.status).toBe(RECIPE_STATUS.retired);
    });

    it("판정이 전부 unknown이면 관측 실패이지 실패가 아니므로 은퇴시키지 않는다", async () => {
        const { repositories, recipesFake, applicationsFake } = makeRepositories();
        recipesFake.seed(makeRecipe("r1", []));
        applicationsFake.seed(makeOpenApplication());
        const projection = new RecipeProjection();

        await projection.resolveForTask(repositories, "task-1", "completed", new Date("2026-01-01T00:03:00.000Z"));

        const recipe = recipesFake.all().find((r) => r.id === "r1");
        expect(recipe?.status).toBe(RECIPE_STATUS.active);
    });
});
