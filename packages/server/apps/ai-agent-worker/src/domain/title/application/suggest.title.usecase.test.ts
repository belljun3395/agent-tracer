import { describe, expect, it } from "vitest";
import { AI_JOB_STEP_ROLE } from "@monitor/kernel";
import { AgentExecutionFailure } from "@monitor/llm-runtime";
import { SuggestTitleUsecase } from "./suggest.title.usecase.js";
import {
    agentRegistry,
    attemptRun,
    emptyOutput,
    FakeTitleAgent,
    fixedClock,
    prep,
    seedRepository,
} from "./title.test-support.js";

describe("SuggestTitleUsecase", () => {
    it("기존 제목과 겹치는 제안을 걷어낸다", async () => {
        const repository = seedRepository();
        const agent = new FakeTitleAgent(
            emptyOutput({
                suggestions: [
                    { title: "기존 제목", rationale: "같음" },
                    { title: "인증 미들웨어 토큰 누수 수정", rationale: "근거" },
                ],
            }),
        );
        const target = new SuggestTitleUsecase(repository, agentRegistry(agent), fixedClock);

        const output = await target.execute(prep(), attemptRun());

        expect(output.suggestions).toEqual([{ title: "인증 미들웨어 토큰 누수 수정", rationale: "근거" }]);
        expect(agent.calls[0]?.apiKey).toBe("sk-test");
    });

    it("내용이 없는 궤적 스텝은 저장 대상에서 뺀다", async () => {
        const repository = seedRepository();
        const agent = new FakeTitleAgent(
            emptyOutput({
                steps: [
                    { seq: 0, role: AI_JOB_STEP_ROLE.assistant, content: "생각", truncated: false, toolCalls: [] },
                    { seq: 1, role: AI_JOB_STEP_ROLE.assistant, content: "  ", truncated: false, toolCalls: [] },
                ],
            }),
        );
        const target = new SuggestTitleUsecase(repository, agentRegistry(agent), fixedClock);

        const output = await target.execute(prep(), attemptRun());

        expect(output.jobSteps).toHaveLength(1);
        expect(output.jobSteps[0]?.id).toBeTypeOf("string");
    });

    it("에이전트가 실패하면 그 시도의 비용과 궤적을 남기고 오류를 다시 던진다", async () => {
        const repository = seedRepository();
        const agent = new FakeTitleAgent(emptyOutput());
        agent.failure = new AgentExecutionFailure("title-suggestion", "AGENT_FAILED", "rate limited", {
            errorSubtype: "rate_limit_error",
            usage: { inputTokens: 4, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
            actualModel: "claude-haiku-4-5",
            durationMs: 400,
        });
        const target = new SuggestTitleUsecase(repository, agentRegistry(agent), fixedClock);

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
        const agent = new FakeTitleAgent(emptyOutput(), false);
        const target = new SuggestTitleUsecase(repository, agentRegistry(agent), fixedClock);

        await target.execute(prep(), attemptRun());

        expect(agent.calls[0]?.apiKey).toBeUndefined();
    });
});
