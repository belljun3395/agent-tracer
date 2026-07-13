import { describe, expect, it } from "vitest";
import { RecipeEntity, TaskEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import { InMemoryRecipeApplicationRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.recipe.repository.js";
import { InMemoryRecipeTaskReader } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.task.reader.js";
import { InMemoryRecipeTaskUserStateReader } from "~tracer-api/domain/recipe/port/__fakes__/in-memory.task.user.state.reader.js";
import { ListRecipesUseCase } from "./list.recipes.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeRecipe(id: string, sliceTaskIds: readonly string[]): RecipeEntity {
    return RecipeEntity.candidate(
        {
            id,
            userId: "u1",
            title: "제목",
            intent: "intent",
            description: "설명",
            summaryMd: "요약",
            request: "요청",
            corrections: [],
            pitfalls: [],
            governingRules: [],
            steps: [],
            touchedFiles: [],
            contributingSlices: sliceTaskIds.map((taskId) => ({ taskId, eventIds: [] })),
        },
        NOW,
    );
}

function makeTask(id: string, userId: string, title: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    task.title = title;
    task.slug = id;
    task.workspacePath = null;
    task.status = "completed";
    task.taskKind = "primary";
    task.origin = "user";
    task.parentTaskId = null;
    task.createdAt = NOW;
    task.updatedAt = NOW;
    task.lastEventAt = null;
    return task;
}

function makeUseCase(args: {
    readonly recipes: readonly RecipeEntity[];
    readonly tasks: readonly TaskEntity[];
    readonly states?: readonly TaskUserStateEntity[];
    readonly taskReader?: InMemoryRecipeTaskReader;
}): ListRecipesUseCase {
    const recipes = new InMemoryRecipeRepository();
    recipes.seed(...args.recipes);
    const tasks = args.taskReader ?? new InMemoryRecipeTaskReader();
    tasks.seed(...args.tasks);
    const states = new InMemoryRecipeTaskUserStateReader();
    states.seed(...(args.states ?? []));
    return new ListRecipesUseCase(recipes, new InMemoryRecipeApplicationRepository(), tasks, states);
}

describe("ListRecipesUseCase", () => {
    it("슬라이스가 인용한 태스크의 제목만 사전으로 내려준다", async () => {
        const usecase = makeUseCase({
            recipes: [makeRecipe("r1", ["t1"])],
            tasks: [makeTask("t1", "u1", "인용된 작업"), makeTask("t2", "u1", "인용되지 않은 작업")],
        });

        const result = await usecase.execute("u1", "candidate");

        expect(result.taskTitles).toEqual({ t1: "인용된 작업" });
    });

    it("인용된 taskId를 레시피마다가 아니라 한 번에 조회한다", async () => {
        const taskReader = new InMemoryRecipeTaskReader();
        const usecase = makeUseCase({
            recipes: [makeRecipe("r1", ["t1"]), makeRecipe("r2", ["t1", "t2"])],
            tasks: [makeTask("t1", "u1", "작업 1"), makeTask("t2", "u1", "작업 2")],
            taskReader,
        });

        await usecase.execute("u1", "candidate");

        expect(taskReader.findByIdsCalls).toHaveLength(1);
        expect([...(taskReader.findByIdsCalls[0] ?? [])].sort()).toEqual(["t1", "t2"]);
    });

    it("사용자가 이름을 바꾼 태스크는 바뀐 제목을 내려준다", async () => {
        const state = TaskUserStateEntity.init("t1", "u1", NOW);
        state.customTitle = "바뀐 제목";
        const usecase = makeUseCase({
            recipes: [makeRecipe("r1", ["t1"])],
            tasks: [makeTask("t1", "u1", "원본 제목")],
            states: [state],
        });

        const result = await usecase.execute("u1", "candidate");

        expect(result.taskTitles.t1).toBe("바뀐 제목");
    });

    it("다른 사용자의 태스크를 인용한 슬라이스는 제목을 내려주지 않는다", async () => {
        const usecase = makeUseCase({
            recipes: [makeRecipe("r1", ["t1"])],
            tasks: [makeTask("t1", "u2", "남의 작업")],
        });

        const result = await usecase.execute("u1", "candidate");

        expect(result.taskTitles).toEqual({});
    });

    it("삭제되어 사라진 태스크를 인용하면 사전에서 빠진다", async () => {
        const usecase = makeUseCase({
            recipes: [makeRecipe("r1", ["gone"])],
            tasks: [],
        });

        const result = await usecase.execute("u1", "candidate");

        expect(result.taskTitles).toEqual({});
        expect(result.items).toHaveLength(1);
    });
});
