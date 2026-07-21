import { describe, expect, it } from "vitest";
import { AI_JOB_STEP_ROLE } from "@monitor/kernel";
import { AgentExecutionFailure } from "@monitor/llm-runtime";
import { SuggestCleanupUsecase } from "./suggest.cleanup.usecase.js";
import {
    agentRegistry,
    attemptRun,
    candidate,
    emptyOutput,
    FakeCleanupAgent,
    fixedClock,
    prep,
    seedRepository,
} from "./cleanup.test-support.js";

describe("SuggestCleanupUsecase", () => {
    it("후보 목록에 없는 태스크 제안은 버린다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(
            emptyOutput({
                suggestions: [
                    { kind: "archive", taskId: "task-1", rationale: "이벤트가 없다", evidenceEventIds: [] },
                    { kind: "archive", taskId: "task-ghost", rationale: "근거 없음", evidenceEventIds: [] },
                ],
            }),
        );
        const target = new SuggestCleanupUsecase(repository, agentRegistry(agent), fixedClock);

        const output = await target.execute(prep(), attemptRun());

        expect(output.suggestions.map((entry) => entry.taskId)).toEqual(["task-1"]);
        expect(output.suggestions[0]?.observedLastEventAt).toBeNull();
        expect(agent.calls[0]?.apiKey).toBe("sk-test");
    });

    it("제안 상한을 넘는 제안은 자른다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(
            emptyOutput({
                suggestions: [
                    { kind: "archive", taskId: "task-1", rationale: "빈 껍데기", evidenceEventIds: [] },
                    { kind: "archive", taskId: "task-2", rationale: "중복", evidenceEventIds: [] },
                ],
            }),
        );
        const target = new SuggestCleanupUsecase(repository, agentRegistry(agent), fixedClock);

        const output = await target.execute(
            prep({ maxSuggestions: 1, candidates: [candidate(), candidate({ id: "task-2" })] }),
            attemptRun(),
        );

        expect(output.suggestions).toHaveLength(1);
    });

    it("내용이 없는 궤적 스텝은 저장 대상에서 뺀다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(
            emptyOutput({
                steps: [
                    { seq: 0, role: AI_JOB_STEP_ROLE.assistant, content: "생각", truncated: false, toolCalls: [] },
                    { seq: 1, role: AI_JOB_STEP_ROLE.assistant, content: "  ", truncated: false, toolCalls: [] },
                ],
            }),
        );
        const target = new SuggestCleanupUsecase(repository, agentRegistry(agent), fixedClock);

        const output = await target.execute(prep(), attemptRun());

        expect(output.jobSteps).toHaveLength(1);
        expect(output.jobSteps[0]?.id).toBeTypeOf("string");
    });

    it("에이전트가 실패하면 그 시도의 비용과 궤적을 남기고 오류를 다시 던진다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(emptyOutput());
        agent.failure = new AgentExecutionFailure("task-cleanup", "AGENT_FAILED", "rate limited", {
            errorSubtype: "rate_limit_error",
            usage: { inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
            actualModel: "claude-haiku-4-5",
            durationMs: 300,
        });
        const target = new SuggestCleanupUsecase(repository, agentRegistry(agent), fixedClock);

        await expect(target.execute(prep(), attemptRun(2))).rejects.toThrow("rate limited");

        expect(repository.failedAttempts).toHaveLength(1);
        expect(repository.failedAttempts[0]?.record).toMatchObject({
            attempt: 2,
            status: "failed",
            subtype: "rate_limit_error",
        });
    });

    it("자격 증명이 필요 없는 백엔드에는 키를 넘기지 않는다", async () => {
        const repository = seedRepository();
        const agent = new FakeCleanupAgent(emptyOutput(), false);
        const target = new SuggestCleanupUsecase(repository, agentRegistry(agent), fixedClock);

        await target.execute(prep(), attemptRun());

        expect(agent.calls[0]?.apiKey).toBeUndefined();
    });
});
