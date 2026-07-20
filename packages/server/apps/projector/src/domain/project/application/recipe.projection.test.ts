import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import {
    RecipeApplicationEntity,
    RecipeApplicationRepository,
} from "@monitor/tracer-domain";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import type { RecipeProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";
import { RecipeProjection } from "./recipe.projection.js";

function makeRepositories() {
    const applicationsFake = createInMemoryRepository<RecipeApplicationEntity>();
    const repositories: RecipeProjectionRepositories = {
        recipeApplications: new RecipeApplicationRepository(asRepository(applicationsFake)),
    };
    return { repositories, applicationsFake };
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
    application.createdAt = new Date("2026-01-01T00:01:00.000Z");
    return application;
}

describe("RecipeProjection.projectInjected", () => {
    it("주입 이벤트를 앵커와 함께 새 적용 이력으로 연다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        const projection = new RecipeProjection();

        await projection.projectInjected(repositories, makeRecord());

        const saved = applicationsFake.all()[0];
        expect(saved).toMatchObject({ id: "app-1", recipeId: "r1", anchorEventId: "event-1", anchorSeq: "5", outcome: null });
    });

    it("같은 태스크·레시피에 이미 열린 적용이 있으면 새로 열지 않는다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        applicationsFake.seed(makeOpenApplication({ id: "existing" }));
        const projection = new RecipeProjection();

        await projection.projectInjected(repositories, makeRecord({ payload: { recipeId: "r1", applicationId: "app-2" } }));

        expect(applicationsFake.all().map((a) => a.id)).toEqual(["existing"]);
    });

    it("다른 레시피의 주입이면 같은 태스크에도 새로 연다", async () => {
        const { repositories, applicationsFake } = makeRepositories();
        applicationsFake.seed(makeOpenApplication({ id: "existing", recipeId: "r1" }));
        const projection = new RecipeProjection();

        await projection.projectInjected(
            repositories,
            makeRecord({ payload: { recipeId: "r2", applicationId: "app-2" } }),
        );

        expect(applicationsFake.all().map((a) => a.id).sort()).toEqual(["app-2", "existing"]);
    });
});
