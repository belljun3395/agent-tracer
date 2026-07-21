import { describe, expect, it } from "vitest";
import { APP_SETTING_KEYS, JOB_STATUS, RECIPE_SCAN_TRIGGER } from "@monitor/kernel";
import { AGENT_BACKEND } from "@monitor/llm-runtime";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import { PrepareRecipeScanUsecase } from "./prepare.recipe.scan.usecase.js";
import {
    agentRegistry,
    CapturingRecipeNotification,
    emptyOutput,
    FakeRecipeAgent,
    fixedClock,
    InMemoryRecipeRepository,
    seedRepository,
} from "./recipe.test-support.js";

function usecase(repository: InMemoryRecipeRepository, agent = new FakeRecipeAgent(emptyOutput())) {
    const notification = new CapturingRecipeNotification();
    const target = new PrepareRecipeScanUsecase(
        repository,
        agentRegistry(agent),
        notification,
        fixedClock,
        AGENT_BACKEND.python,
    );
    return { target, notification };
}

describe("PrepareRecipeScanUsecase", () => {
    it("잡을 실행 상태로 올리고 실행 인자를 확정한다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.anthropicModel, "claude-sonnet-4-6");
        const { target, notification } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1", language: "ko" });

        expect(prepared).toMatchObject({
            jobId: "job-1",
            userId: "user-1",
            taskId: "task-1",
            agentBackend: AGENT_BACKEND.python,
            language: OUTPUT_LANGUAGE.ko,
            model: "claude-sonnet-4-6",
        });
        expect(repository.started).toEqual(["job-1"]);
        expect(notification.published[0]?.payload["status"]).toBe(JOB_STATUS.running);
    });

    it("잡 입력의 백엔드가 워커 기본값보다 우선한다", async () => {
        const { target } = usecase(seedRepository());

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1", agentBackend: "claude-sdk" });

        expect(prepared.agentBackend).toBe(AGENT_BACKEND.claudeSdk);
    });

    it("지원하지 않는 출력 언어는 auto로 되돌린다", async () => {
        const { target } = usecase(seedRepository());

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1", language: "kr" });

        expect(prepared.language).toBe(OUTPUT_LANGUAGE.auto);
    });

    it("잡이 없으면 실행하지 않는다", async () => {
        const { target } = usecase(new InMemoryRecipeRepository());

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("job not found: job-1");
    });

    it("사용자 소유가 아닌 태스크는 앵커로 쓰지 않는다", async () => {
        const repository = seedRepository();
        repository.anchors.set("task-1", { ownedByUser: false, scanEligible: true, sessionScanEligible: true });
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("task not found: task-1");
    });

    it("세션 트리거는 세션 앵커 자격으로 판정한다", async () => {
        const repository = seedRepository();
        repository.anchors.set("task-1", { ownedByUser: true, scanEligible: false, sessionScanEligible: true });
        const { target } = usecase(repository);

        const prepared = await target.execute({
            jobId: "job-1",
            taskId: "task-1",
            trigger: RECIPE_SCAN_TRIGGER.session,
        });

        expect(prepared.taskId).toBe("task-1");
        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow(
            "task is not a recipe scan anchor: task-1",
        );
    });

    it("이미 종결된 잡은 다시 시작하지 않는다", async () => {
        const repository = seedRepository();
        repository.startWins = false;
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow(
            "job already settled by another transition: job-1",
        );
    });

    it("자격 증명이 필요한 백엔드인데 키가 없으면 실행하지 않는다", async () => {
        const repository = seedRepository();
        repository.settings.delete(APP_SETTING_KEYS.anthropicApiKey);
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("No LLM API key configured");
    });
});
