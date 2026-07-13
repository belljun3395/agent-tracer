import { describe, expect, it } from "vitest";
import {
    AGENT_TRACER_ATTR,
    KIND,
    RULE_EXPECTATION_KIND,
    RULE_REVIEW_STATE,
    RULE_SCOPE,
    VERDICT_STATUS,
    type RuleExpectation,
    type RuleTrigger,
} from "@monitor/kernel";
import { EventEntity, RuleEntity, TurnEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/rule/port/__fakes__/in-memory.event.reader.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { RuleBackfillService } from "~tracer-api/domain/rule/application/rule.backfill.service.js";
import { ReevaluateRuleUseCase } from "./reevaluate.rule.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRule(overrides: {
    readonly id: string;
    readonly scope: RuleEntity["scope"];
    readonly taskId: string | null;
    readonly trigger?: RuleTrigger;
    readonly expectation?: RuleExpectation;
}): RuleEntity {
    const rule = new RuleEntity();
    rule.id = overrides.id;
    rule.userId = "u1";
    rule.name = "규칙";
    rule.trigger = overrides.trigger ?? { phrases: [] };
    rule.expectation = overrides.expectation ?? {
        kind: RULE_EXPECTATION_KIND.command,
        commandMatches: ["gh run view"],
    };
    rule.scope = overrides.scope;
    rule.taskId = overrides.taskId;
    rule.source = "human";
    rule.severity = "info";
    rule.reviewState = RULE_REVIEW_STATE.active;
    rule.rationale = null;
    rule.signature = "sig";
    rule.createdAt = NOW;
    rule.deletedAt = null;
    return rule;
}

function makeTurn(taskId: string): TurnEntity {
    const turn = TurnEntity.open("session-1", taskId, 1, "github.com/runs/1 확인하고 해결해줘", NOW);
    turn.close("확인했습니다.", new Date("2026-01-01T00:05:00.000Z"));
    return turn;
}

function makeCommandEvent(turn: TurnEntity, command: string): EventEntity {
    const event = new EventEntity();
    event.id = "event-1";
    event.seq = "1";
    event.userId = "u1";
    event.taskId = turn.taskId;
    event.sessionId = turn.sessionId;
    event.turnId = turn.id;
    event.kind = KIND.executeTool;
    event.lane = "implementation";
    event.title = "View GitHub Actions run details";
    event.body = `$ ${command}`;
    event.toolName = null;
    event.filePaths = [];
    event.metadata = { [AGENT_TRACER_ATTR.command]: command };
    event.occurredAt = NOW;
    return event;
}

function makeUseCase(rules: readonly RuleEntity[], turns: readonly TurnEntity[], events: readonly EventEntity[]) {
    const ruleRepo = new InMemoryRuleRepository();
    const turnRepo = new InMemoryTurnRepository();
    const eventRepo = new InMemoryEventReader();
    const verdictRepo = new InMemoryVerdictRepository();
    ruleRepo.seed(...rules);
    turnRepo.seed(...turns);
    eventRepo.seed(...events);
    const useCase = new ReevaluateRuleUseCase(ruleRepo, new RuleBackfillService(turnRepo, eventRepo, verdictRepo));
    return { useCase, verdictRepo, turnRepo };
}

describe("ReevaluateRuleUseCase", () => {
    it("전역 규칙을 지정한 작업의 턴에 다시 평가한다", async () => {
        const rule = makeRule({ id: "rule-1", scope: RULE_SCOPE.global, taskId: null });
        const turn = makeTurn("task-1");
        const event = makeCommandEvent(turn, "gh run view 85534985858 2>&1 | head -60");
        const { useCase, verdictRepo, turnRepo } = makeUseCase([rule], [turn], [event]);

        const result = await useCase.execute("u1", "rule-1", { taskId: "task-1" });

        expect(result).toEqual({ reevaluated: 1 });
        expect(verdictRepo.all()).toMatchObject([
            { ruleId: "rule-1", turnId: turn.id, status: VERDICT_STATUS.verified },
        ]);
        expect(turnRepo.all()[0]).toMatchObject({
            aggregateVerdict: VERDICT_STATUS.verified,
            rulesEvaluatedCount: 1,
        });
    });
});
