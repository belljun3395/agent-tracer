import { describe, expect, it } from "vitest";
import { APP_SETTING_KEYS, JOB_STATUS } from "@monitor/kernel";
import { AGENT_BACKEND } from "@monitor/llm-runtime";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import { PrepareTitleSuggestionUsecase } from "./prepare.title.suggestion.usecase.js";
import {
    agentRegistry,
    CapturingTitleNotification,
    emptyOutput,
    FakeTitleAgent,
    fixedClock,
    InMemoryTitleRepository,
    seedRepository,
    titleContext,
} from "./title.test-support.js";

function usecase(repository: InMemoryTitleRepository) {
    const notification = new CapturingTitleNotification();
    const target = new PrepareTitleSuggestionUsecase(
        repository,
        agentRegistry(new FakeTitleAgent(emptyOutput())),
        notification,
        fixedClock,
        AGENT_BACKEND.python,
    );
    return { target, notification };
}

describe("PrepareTitleSuggestionUsecase", () => {
    it("잡을 실행 상태로 올리고 대화 컨텍스트를 실어 실행 인자를 확정한다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.anthropicModel, "claude-haiku-4-5");
        repository.settings.set(APP_SETTING_KEYS.claudeOutputLanguage, "ko");
        const { target, notification } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prepared).toMatchObject({
            jobId: "job-1",
            userId: "user-1",
            taskId: "task-1",
            agentBackend: AGENT_BACKEND.python,
            language: OUTPUT_LANGUAGE.ko,
            currentTitle: "기존 제목",
            model: "claude-haiku-4-5",
        });
        expect(repository.started).toEqual(["job-1"]);
        expect(notification.published[0]?.payload["status"]).toBe(JOB_STATUS.running);
    });

    it("잡 입력의 백엔드가 워커 기본값보다 우선한다", async () => {
        const { target } = usecase(seedRepository());

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1", agentBackend: "claude-sdk" });

        expect(prepared.agentBackend).toBe(AGENT_BACKEND.claudeSdk);
    });

    it("설정에 없는 출력 언어는 auto로 되돌린다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.claudeOutputLanguage, "kr");
        const { target } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1", taskId: "task-1" });

        expect(prepared.language).toBe(OUTPUT_LANGUAGE.auto);
    });

    it("잡이 없으면 실행하지 않는다", async () => {
        const { target } = usecase(new InMemoryTitleRepository());

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("job not found: job-1");
    });

    it("사용자 소유가 아닌 태스크는 제목을 짓지 않는다", async () => {
        const repository = seedRepository();
        repository.contexts.set("task-1", { ownedByUser: false, totalEventCount: 12, context: null });
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("task not found: task-1");
    });

    it("이벤트가 없는 태스크는 근거가 없어 실행하지 않는다", async () => {
        const repository = seedRepository();
        repository.contexts.set("task-1", {
            ownedByUser: true,
            totalEventCount: 0,
            context: titleContext({ totalEventCount: 0 }),
        });
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1", taskId: "task-1" })).rejects.toThrow("task has no events: task-1");
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
