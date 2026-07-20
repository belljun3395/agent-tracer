import {describe, expect, it} from "vitest";
import {RequestRecipeScanUsecase} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import {InMemoryRecipeScanJob} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.scan.job.js";

function request(prompt: string) {
    return {taskId: "task-1", eventId: "event-1", prompt};
}

describe("RequestRecipeScanUsecase", () => {
    it("레시피 명령이 오면 이벤트 ID를 멱등키로 스캔 잡을 넣는다", async () => {
        const jobs = new InMemoryRecipeScanJob();

        expect(await new RequestRecipeScanUsecase(jobs).execute(request("/recipe 로그인 흐름"))).toBe(true);
        expect(jobs.enqueued).toEqual([
            {taskId: "task-1", idempotencyKey: "event-1", userPrompt: "로그인 흐름"},
        ]);
    });

    it("의도 없이 명령만 오면 프롬프트 없이 잡을 넣는다", async () => {
        const jobs = new InMemoryRecipeScanJob();

        await new RequestRecipeScanUsecase(jobs).execute(request("/recipe"));

        expect(jobs.enqueued[0]).toEqual({taskId: "task-1", idempotencyKey: "event-1"});
    });

    it("레시피 명령이 아닌 발화는 스캔하지 않는다", async () => {
        const jobs = new InMemoryRecipeScanJob();

        expect(await new RequestRecipeScanUsecase(jobs).execute(request("테스트 돌려줘"))).toBe(false);
        expect(jobs.enqueued).toEqual([]);
    });

    it("진행 중인 스캔이 있으면 건너뛴다", async () => {
        const jobs = new InMemoryRecipeScanJob();
        jobs.markActive();

        expect(await new RequestRecipeScanUsecase(jobs).execute(request("/recipe"))).toBe(false);
        expect(jobs.enqueued).toEqual([]);
    });

    it("태스크나 근거 이벤트를 모르면 스캔하지 않는다", async () => {
        const jobs = new InMemoryRecipeScanJob();
        const usecase = new RequestRecipeScanUsecase(jobs);

        expect(await usecase.execute({taskId: "", eventId: "event-1", prompt: "/recipe"})).toBe(false);
        expect(await usecase.execute({taskId: "task-1", eventId: "", prompt: "/recipe"})).toBe(false);
    });

    it("잡 큐잉이 던지면 예외로 튀지 않고 false를 낸다", async () => {
        const jobs = new InMemoryRecipeScanJob();
        jobs.enqueue = () => {
            throw new Error("network down");
        };
        const usecase = new RequestRecipeScanUsecase(jobs);

        await expect(usecase.execute(request("/recipe"))).resolves.toBe(false);
    });
});
