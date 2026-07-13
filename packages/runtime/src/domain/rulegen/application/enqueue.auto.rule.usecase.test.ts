import {KIND} from "@monitor/kernel/ingest/event.kind.const.js";
import {describe, expect, it} from "vitest";
import {EnqueueAutoRuleUsecase} from "~runtime/domain/rulegen/application/enqueue.auto.rule.usecase.js";
import {AutoTriggerSettingCache} from "~runtime/domain/rulegen/model/auto.trigger.model.js";
import {InMemoryRuleJob} from "~runtime/domain/rulegen/port/__fakes__/in-memory.rule.job.js";

function enabledCache(maxRulesPerTask = 2): AutoTriggerSettingCache {
    const cache = new AutoTriggerSettingCache();
    cache.replace({enabled: true, maxRulesPerTask});
    return cache;
}

describe("EnqueueAutoRuleUsecase", () => {
    it("토글이 켜진 상태의 규칙 명령이면 앵커 이벤트로 잡을 넣는다", async () => {
        const jobs = new InMemoryRuleJob();

        await new EnqueueAutoRuleUsecase(jobs, enabledCache(3))
            .execute(KIND.userMessage, "t1", "e1", "/rule 이번 턴에서 규칙을 뽑아줘");

        expect(jobs.enqueued).toEqual([{taskId: "t1", anchorEventId: "e1", maxRules: 3}]);
    });

    it("플러그인 네임스페이스가 붙은 호출도 규칙 명령으로 본다", async () => {
        const jobs = new InMemoryRuleJob();

        await new EnqueueAutoRuleUsecase(jobs, enabledCache())
            .execute(KIND.userMessage, "t1", "e1", "/agent-tracer-monitor:rule @README.md 확인해줘");

        expect(jobs.enqueued).toHaveLength(1);
    });

    it("토글이 꺼져 있으면 아무 요청도 보내지 않는다", async () => {
        const jobs = new InMemoryRuleJob();

        await new EnqueueAutoRuleUsecase(jobs, new AutoTriggerSettingCache())
            .execute(KIND.userMessage, "t1", "e1", "/rule");

        expect(jobs.enqueued).toEqual([]);
    });

    it("규칙 명령이 아닌 사용자 입력은 잡을 넣지 않는다", async () => {
        const jobs = new InMemoryRuleJob();

        await new EnqueueAutoRuleUsecase(jobs, enabledCache())
            .execute(KIND.userMessage, "t1", "e1", "일반 요청입니다");

        expect(jobs.enqueued).toEqual([]);
    });

    it("사용자 입력이 아닌 이벤트는 잡을 넣지 않는다", async () => {
        const jobs = new InMemoryRuleJob();

        await new EnqueueAutoRuleUsecase(jobs, enabledCache())
            .execute(KIND.assistantResponse, "t1", "e1", "/rule");

        expect(jobs.enqueued).toEqual([]);
    });

    it("태스크에 진행 중인 잡이 있으면 새로 넣지 않는다", async () => {
        const jobs = new InMemoryRuleJob();
        jobs.activeJob = true;

        await new EnqueueAutoRuleUsecase(jobs, enabledCache())
            .execute(KIND.userMessage, "t1", "e1", "/rule");

        expect(jobs.enqueued).toEqual([]);
    });
});
