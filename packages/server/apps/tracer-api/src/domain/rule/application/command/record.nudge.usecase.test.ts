import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import {
    NUDGE_LIMIT,
    RULE_EXPECTATION_KIND,
    RULE_REVIEW_STATE,
    RULE_SEVERITY,
    RULE_SOURCE,
    VERDICT_STATUS,
} from "@monitor/kernel";
import { RuleEntity, VerdictEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/rule/port/__fakes__/fixed.clock.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { RecordNudgeUseCase } from "./record.nudge.usecase.js";

const NOW = new Date("2026-07-14T00:00:00.000Z");

const EVIDENCE = {
    actualToolCalls: [],
    matchedToolCalls: [],
    unclassifiedEventIds: [],
    enforcements: [],
};

function rule(): RuleEntity {
    const entity = new RuleEntity();
    entity.id = "r1";
    entity.userId = "u1";
    entity.name = "배포 전 테스트 실행";
    entity.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    entity.taskId = "task-1";
    entity.source = RULE_SOURCE.agent;
    entity.severity = RULE_SEVERITY.warn;
    entity.rationale = null;
    entity.signature = "sig";
    entity.userEdited = false;
    entity.reviewState = RULE_REVIEW_STATE.active;
    entity.lastEditedBy = RULE_SOURCE.agent;
    entity.rev = 1;
    entity.sourceJobId = null;
    entity.anchorEventId = "event-1";
    entity.createdAt = NOW;
    entity.deletedAt = null;
    return entity;
}

function makeUseCase(verdicts: readonly VerdictEntity[]): {
    useCase: RecordNudgeUseCase;
    verdictRepo: InMemoryVerdictRepository;
} {
    const rules = new InMemoryRuleRepository();
    rules.seed(rule());
    const verdictRepo = new InMemoryVerdictRepository();
    verdictRepo.seed(...verdicts);
    return { useCase: new RecordNudgeUseCase(rules, verdictRepo, new FixedClock(NOW)), verdictRepo };
}

function openVerdict(nudgeCount: number): VerdictEntity {
    const verdict = VerdictEntity.open("r1", "turn-1", RULE_SEVERITY.warn, EVIDENCE, NOW);
    verdict.nudgeCount = nudgeCount;
    return verdict;
}

describe("RecordNudgeUseCase", () => {
    // 상한이 데몬 재기동을 넘어 살아남으려면 알린 횟수가 서버에 남아야 한다.
    it("살아 있는 판정에 알린 횟수를 누적해 저장한다", async () => {
        const { useCase, verdictRepo } = makeUseCase([openVerdict(0)]);

        const result = await useCase.execute("u1", "r1");

        expect(result.nudgeCount).toBe(1);
        expect(result.escalated).toBe(false);
        expect((await verdictRepo.findByRule("r1"))?.nudgeCount).toBe(1);
    });

    it("상한만큼 알린 판정은 에스컬레이션으로 알린다", async () => {
        const { useCase } = makeUseCase([openVerdict(NUDGE_LIMIT - 1)]);

        const result = await useCase.execute("u1", "r1");

        expect(result.nudgeCount).toBe(NUDGE_LIMIT);
        expect(result.escalated).toBe(true);
    });

    it("이미 끝난 판정은 세지 않는다", async () => {
        const verdict = openVerdict(2);
        verdict.status = VERDICT_STATUS.satisfied;
        const { useCase, verdictRepo } = makeUseCase([verdict]);

        const result = await useCase.execute("u1", "r1");

        expect(result).toEqual({ nudgeCount: 2, escalated: false });
        expect((await verdictRepo.findByRule("r1"))?.nudgeCount).toBe(2);
    });

    it("판정이 아직 없으면 셀 것도 없다", async () => {
        const { useCase } = makeUseCase([]);

        expect(await useCase.execute("u1", "r1")).toEqual({ nudgeCount: 0, escalated: false });
    });

    it("남의 규칙은 존재하지 않는 규칙처럼 거부한다", async () => {
        const { useCase } = makeUseCase([openVerdict(0)]);

        await expect(useCase.execute("u2", "r1")).rejects.toThrow(NotFoundException);
    });
});
