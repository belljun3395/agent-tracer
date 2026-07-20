import { describe, expect, it } from "vitest";
import { KIND, RECIPE_VERDICT } from "@monitor/kernel";
import { RecipeEntity } from "./recipe.entity.js";
import { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import { RecipeLifecycle } from "./recipe.lifecycle.domain.js";
import type { RecipeCandidateInput } from "./recipe.types.js";
import type { RecipeVerifyWindowEvent } from "./model/recipe.compliance.model.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRecipe(input: Partial<RecipeCandidateInput> = {}, createdAt: Date = NOW): RecipeEntity {
    const base: RecipeCandidateInput = {
        id: "r1",
        userId: "u1",
        title: "제목",
        intent: "intent",
        description: "설명",
        summaryMd: "요약",
        request: "사용자가 작업 절차를 recipe로 만들라고 했다.",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [{ order: 1, action: "테스트를 돌린다", verify: { kind: "command", commandMatches: ["npm test"] } }],
        touchedFiles: [],
        contributingSlices: [],
        ...input,
    };
    const recipe = RecipeEntity.candidate(base, createdAt);
    recipe.accept(createdAt);
    return recipe;
}

function makeApplication(overrides: Partial<RecipeApplicationEntity> = {}): RecipeApplicationEntity {
    const app = new RecipeApplicationEntity();
    app.id = overrides.id ?? "app1";
    app.userId = "u1";
    app.recipeId = "r1";
    app.taskId = overrides.taskId ?? "task1";
    app.injectedVia = "pull";
    app.outcome = overrides.outcome ?? null;
    app.note = null;
    app.anchorEventId = overrides.anchorEventId ?? "anchor1";
    app.anchorSeq = overrides.anchorSeq ?? "1";
    app.verdict = overrides.verdict ?? null;
    app.verdictEvidence = overrides.verdictEvidence ?? null;
    app.createdAt = NOW;
    app.resolvedAt = null;
    return app;
}

const FOLLOWED_EVENT: RecipeVerifyWindowEvent = {
    kind: KIND.executeTool,
    toolName: "Bash",
    filePaths: [],
    metadata: { "agent_tracer.command": "npm test" },
};

describe("RecipeLifecycle", () => {
    describe("stats", () => {
        it("적용 이력이 없으면 applicationCount와 successRate가 모두 0이다", () => {
            const lifecycle = new RecipeLifecycle(makeRecipe(), []);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 0,
                decidedCount: 0,
                successRate: 0,
                verdicts: { followedAndHelped: 0, followedNotHelped: 0, abandoned: 0, unknown: 0 },
            });
        });

        it("followed_and_helped 비율로 successRate를 계산한다", () => {
            const applications = [
                makeApplication({ id: "a", verdict: RECIPE_VERDICT.followedAndHelped }),
                makeApplication({ id: "b", verdict: RECIPE_VERDICT.abandoned }),
                makeApplication({ id: "c", verdict: RECIPE_VERDICT.followedAndHelped }),
            ];
            const lifecycle = new RecipeLifecycle(makeRecipe(), applications);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 3,
                decidedCount: 3,
                successRate: 2 / 3,
                verdicts: { followedAndHelped: 2, followedNotHelped: 0, abandoned: 1, unknown: 0 },
            });
        });

        it("unknown은 decidedCount와 successRate의 분모에서 빠지지만 applicationCount에는 들어간다", () => {
            const applications = [
                makeApplication({ id: "a", verdict: RECIPE_VERDICT.followedAndHelped }),
                makeApplication({ id: "b", verdict: RECIPE_VERDICT.unknown }),
                makeApplication({ id: "c", verdict: null }),
            ];
            const lifecycle = new RecipeLifecycle(makeRecipe(), applications);
            expect(lifecycle.stats()).toEqual({
                applicationCount: 3,
                decidedCount: 1,
                successRate: 1,
                verdicts: { followedAndHelped: 1, followedNotHelped: 0, abandoned: 0, unknown: 1 },
            });
        });
    });

    describe("shouldRetire", () => {
        const OLD = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);

        it("당겨졌으나 전부 unknown으로 판정된 레시피는 오래돼도 은퇴 대상이 아니다", () => {
            const recipe = makeRecipe({}, OLD);
            const applications = [
                makeApplication({ id: "a", verdict: RECIPE_VERDICT.unknown }),
                makeApplication({ id: "b", verdict: RECIPE_VERDICT.unknown }),
            ];
            const lifecycle = new RecipeLifecycle(recipe, applications);
            expect(lifecycle.shouldRetire(NOW)).toBe(false);
        });

        it("한 번도 당겨지지 않고 오래된 레시피는 은퇴 대상이다", () => {
            const recipe = makeRecipe({}, OLD);
            const lifecycle = new RecipeLifecycle(recipe, []);
            expect(lifecycle.shouldRetire(NOW)).toBe(true);
        });
    });

    describe("resolveVerdicts", () => {
        it("태스크가 completed로 끝나고 이행 증거를 찾으면 followed_and_helped로 종결한다", () => {
            const application = makeApplication({ taskId: "task1" });
            const lifecycle = new RecipeLifecycle(
                makeRecipe(),
                [application],
            );
            const windowEvents = new Map([["app1", [FOLLOWED_EVENT]]]);
            const changed = lifecycle.resolveVerdicts("completed", "task1", windowEvents, NOW);
            expect(changed).toHaveLength(1);
            expect(application.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
            expect(application.verdictEvidence?.followedStepOrders).toEqual([1]);
            expect(application.resolvedAt).toEqual(NOW);
        });

        it("이행 증거가 없고 창을 빠짐없이 관측했으면 abandoned로 종결한다", () => {
            const application = makeApplication({ taskId: "task1" });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveVerdicts("completed", "task1", new Map(), NOW);
            expect(changed).toHaveLength(1);
            expect(application.verdict).toBe(RECIPE_VERDICT.abandoned);
        });

        it("verify를 가진 스텝이 없어 관측으로 판정할 수 없으면 자기보고를 폴백 근거로 쓴다", () => {
            const application = makeApplication({ taskId: "task1", outcome: "completed" });
            const lifecycle = new RecipeLifecycle(makeRecipe({ steps: [] }), [application]);
            lifecycle.resolveVerdicts("completed", "task1", new Map(), NOW);
            expect(application.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
            expect(application.verdictEvidence?.source).toBe("self-report");
        });

        it("completed/errored가 아닌 상태로는 아무것도 종결하지 않는다", () => {
            const application = makeApplication({ taskId: "task1" });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveVerdicts("running", "task1", new Map(), NOW);
            expect(changed).toEqual([]);
            expect(application.verdict).toBeNull();
        });

        it("다른 태스크의 이력은 건드리지 않는다", () => {
            const application = makeApplication({ taskId: "other-task" });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveVerdicts("completed", "task1", new Map(), NOW);
            expect(changed).toEqual([]);
        });

        it("이미 판정이 종결된 이력은 다시 판정하지 않는다", () => {
            const application = makeApplication({ taskId: "task1", verdict: RECIPE_VERDICT.followedAndHelped });
            const lifecycle = new RecipeLifecycle(makeRecipe(), [application]);
            const changed = lifecycle.resolveVerdicts("completed", "task1", new Map(), NOW);
            expect(changed).toEqual([]);
        });
    });
});
