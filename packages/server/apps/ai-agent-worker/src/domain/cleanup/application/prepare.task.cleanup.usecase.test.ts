import { describe, expect, it } from "vitest";
import { APP_SETTING_KEYS, JOB_STATUS } from "@monitor/kernel";
import { AGENT_BACKEND } from "@monitor/llm-runtime";
import { OUTPUT_LANGUAGE } from "~ai-agent-worker/support/output.language.js";
import { CLEANUP_CANDIDATE_REASON } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import { PrepareTaskCleanupUsecase } from "./prepare.task.cleanup.usecase.js";
import {
    agentRegistry,
    CapturingCleanupNotification,
    emptyOutput,
    FakeCleanupAgent,
    fixedClock,
    InMemoryCleanupRepository,
    seedRepository,
} from "./cleanup.test-support.js";

function usecase(repository: InMemoryCleanupRepository) {
    const notification = new CapturingCleanupNotification();
    const target = new PrepareTaskCleanupUsecase(
        repository,
        agentRegistry(new FakeCleanupAgent(emptyOutput())),
        notification,
        fixedClock,
        AGENT_BACKEND.python,
    );
    return { target, notification };
}

describe("PrepareTaskCleanupUsecase", () => {
    it("잡을 실행 상태로 올리고 결정론적으로 계산한 후보를 싣는다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.claudeOutputLanguage, "ko");
        const { target, notification } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1" });

        expect(prepared).toMatchObject({
            jobId: "job-1",
            userId: "user-1",
            agentBackend: AGENT_BACKEND.python,
            language: OUTPUT_LANGUAGE.ko,
            tasksScanned: 2,
        });
        expect(prepared.candidates.map((entry) => entry.id)).toEqual(["task-1"]);
        expect(prepared.candidates[0]?.candidateReasons).toContain(CLEANUP_CANDIDATE_REASON.noEvents);
        expect(repository.started).toEqual(["job-1"]);
        expect(notification.published[0]?.payload["status"]).toBe(JOB_STATUS.running);
    });

    it("잡 입력의 제안 상한이 설정값보다 우선한다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.taskCleanupMaxSuggestions, "5");
        const { target } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1", maxSuggestions: 3 });

        expect(prepared.maxSuggestions).toBe(3);
    });

    it("제안 상한이 없으면 설정값을 읽고 상한을 넘지 않게 자른다", async () => {
        const repository = seedRepository();
        repository.settings.set(APP_SETTING_KEYS.taskCleanupMaxSuggestions, "900");
        const { target } = usecase(repository);

        const prepared = await target.execute({ jobId: "job-1" });

        expect(prepared.maxSuggestions).toBe(50);
    });

    it("잡 입력의 백엔드가 워커 기본값보다 우선한다", async () => {
        const { target } = usecase(seedRepository());

        const prepared = await target.execute({ jobId: "job-1", agentBackend: "claude-sdk" });

        expect(prepared.agentBackend).toBe(AGENT_BACKEND.claudeSdk);
    });

    it("잡이 없으면 실행하지 않는다", async () => {
        const { target } = usecase(new InMemoryCleanupRepository());

        await expect(target.execute({ jobId: "job-1" })).rejects.toThrow("job not found: job-1");
    });

    it("이미 종결된 잡은 다시 시작하지 않는다", async () => {
        const repository = seedRepository();
        repository.startWins = false;
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1" })).rejects.toThrow(
            "job already settled by another transition: job-1",
        );
    });

    it("자격 증명이 필요한 백엔드인데 키가 없으면 실행하지 않는다", async () => {
        const repository = seedRepository();
        repository.settings.delete(APP_SETTING_KEYS.anthropicApiKey);
        const { target } = usecase(repository);

        await expect(target.execute({ jobId: "job-1" })).rejects.toThrow("No LLM API key configured");
    });
});
