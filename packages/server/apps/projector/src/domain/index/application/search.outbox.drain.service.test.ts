import { describe, expect, it } from "vitest";
import { RecipeEntity, SEARCH_OUTBOX_TARGET, SearchOutboxEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import { SearchOutboxDrainService } from "~projector/domain/index/application/search.outbox.drain.service.js";
import { InMemoryAdvisoryLock } from "~projector/domain/index/port/__fakes__/in-memory.advisory.lock.js";
import {
    InMemorySearchOutboxRecipeRepository,
    InMemorySearchOutboxRepository,
    InMemorySearchOutboxTaskUserStateRepository,
} from "~projector/domain/index/port/__fakes__/in-memory.search.outbox.repositories.js";
import { InMemorySearchIndex } from "~projector/domain/index/port/__fakes__/in-memory.search.index.js";

const NOW = new Date("2026-07-11T00:00:00.000Z");
const RECIPES_ALIAS = "recipes";
const TASKS_ALIAS = "tasks";

function outboxRow(id: string, target: (typeof SEARCH_OUTBOX_TARGET)[keyof typeof SEARCH_OUTBOX_TARGET], targetId: string): SearchOutboxEntity {
    return SearchOutboxEntity.enqueue({ id, userId: "u1", target, targetId, now: NOW });
}

function recipe(id: string): RecipeEntity {
    const entity = new RecipeEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.title = "레시피";
    entity.intent = "의도";
    entity.description = "설명";
    entity.summaryMd = "- 요약";
    entity.touchedFiles = [];
    entity.status = "candidate";
    entity.userEdited = false;
    entity.updatedAt = NOW;
    return entity;
}

function archivedTaskState(taskId: string): TaskUserStateEntity {
    const state = TaskUserStateEntity.init(taskId, "u1", NOW);
    state.archive(NOW);
    return state;
}

interface Harness {
    readonly service: SearchOutboxDrainService;
    readonly outbox: InMemorySearchOutboxRepository;
    readonly searchIndex: InMemorySearchIndex;
}

function makeService(args: {
    readonly rows: readonly SearchOutboxEntity[];
    readonly recipes?: readonly RecipeEntity[];
    readonly taskStates?: readonly TaskUserStateEntity[];
    readonly indexFails?: boolean;
    readonly updateFails?: boolean;
}): Harness {
    const outbox = new InMemorySearchOutboxRepository();
    outbox.seed(...args.rows);
    const recipes = new InMemorySearchOutboxRecipeRepository();
    recipes.seed(...args.recipes ?? []);
    const taskUserStates = new InMemorySearchOutboxTaskUserStateRepository();
    taskUserStates.seed(...args.taskStates ?? []);
    const lock = new InMemoryAdvisoryLock({ searchOutbox: outbox, recipes, taskUserStates });
    const searchIndex = new InMemorySearchIndex();
    searchIndex.indexFails = args.indexFails === true;
    searchIndex.updateFails = args.updateFails === true;
    return { service: new SearchOutboxDrainService(lock, searchIndex), outbox, searchIndex };
}

describe("SearchOutboxDrainService", () => {
    it("적재된 레시피를 인덱싱하고 아웃박스 행을 지운다", async () => {
        const h = makeService({ rows: [outboxRow("o1", SEARCH_OUTBOX_TARGET.recipe, "r1")], recipes: [recipe("r1")] });

        const applied = await h.service.runOnce();

        expect(applied).toBe(1);
        expect(h.searchIndex.documentIds(RECIPES_ALIAS)).toEqual(["r1"]);
        expect(h.outbox.pending()).toHaveLength(0);
    });

    it("인덱싱에 실패하면 행을 남겨 다음 배출에서 다시 시도한다", async () => {
        const h = makeService({
            rows: [outboxRow("o1", SEARCH_OUTBOX_TARGET.recipe, "r1")],
            recipes: [recipe("r1")],
            indexFails: true,
        });

        const applied = await h.service.runOnce();

        expect(applied).toBe(0);
        expect(h.outbox.pending()).toHaveLength(1);
        expect(h.outbox.failures.map((failure) => ({ id: failure.id, attempts: failure.attempts }))).toEqual([
            { id: "o1", attempts: 1 },
        ]);
    });

    it("대상 레시피가 사라졌으면 행을 지워 큐가 막히지 않게 한다", async () => {
        const h = makeService({ rows: [outboxRow("o1", SEARCH_OUTBOX_TARGET.recipe, "gone")] });

        const applied = await h.service.runOnce();

        expect(applied).toBe(1);
        expect(h.searchIndex.documentIds(RECIPES_ALIAS)).toEqual([]);
        expect(h.outbox.pending()).toHaveLength(0);
    });

    it("적재된 태스크 보관 상태를 검색 인덱스에 반영하고 아웃박스 행을 지운다", async () => {
        const h = makeService({
            rows: [outboxRow("o1", SEARCH_OUTBOX_TARGET.task, "t1")],
            taskStates: [archivedTaskState("t1")],
        });

        const applied = await h.service.runOnce();

        expect(applied).toBe(1);
        expect(h.searchIndex.document(TASKS_ALIAS, "t1")).toEqual({ archived: true });
        expect(h.outbox.pending()).toHaveLength(0);
    });

    it("태스크 색인 갱신이 실패하면 행을 남겨 다음 배출에서 다시 시도한다", async () => {
        const h = makeService({
            rows: [outboxRow("o1", SEARCH_OUTBOX_TARGET.task, "t1")],
            taskStates: [archivedTaskState("t1")],
            updateFails: true,
        });

        const applied = await h.service.runOnce();

        expect(applied).toBe(0);
        expect(h.outbox.pending()).toHaveLength(1);
        expect(h.outbox.failures.map((failure) => ({ id: failure.id, attempts: failure.attempts }))).toEqual([
            { id: "o1", attempts: 1 },
        ]);
    });
});
