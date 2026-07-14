import { describe, expect, it } from "vitest";
import {
    AGENT_TRACER_ATTR,
    KIND,
    RULE_EXPECTATION_KIND,
    RULE_REVIEW_STATE,
    RULE_SEVERITY,
    RULE_SOURCE,
    VERDICT_STATUS,
} from "@monitor/kernel";
import { EventEntity, RuleEntity, TurnEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/rule/port/__fakes__/fixed.clock.js";
import { InMemoryEventReader } from "~tracer-api/domain/rule/port/__fakes__/in-memory.event.reader.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { RuleBackfillService } from "./rule.backfill.service.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function rule(reviewState: RuleEntity["reviewState"]): RuleEntity {
    const entity = new RuleEntity();
    entity.id = "rule-1";
    entity.userId = "u1";
    entity.name = "린트 실행";
    entity.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] };
    entity.taskId = "task-1";
    entity.anchorEventId = "anchor-1";
    entity.source = RULE_SOURCE.agent;
    entity.severity = RULE_SEVERITY.info;
    entity.reviewState = reviewState;
    entity.rationale = null;
    entity.signature = "sig";
    entity.createdAt = NOW;
    entity.deletedAt = null;
    return entity;
}

function pastTurn(): TurnEntity {
    const turn = TurnEntity.open("session-1", "task-1", 1, "린트 돌려줘", NOW);
    turn.close("돌렸습니다.", new Date("2026-01-01T00:05:00.000Z"));
    return turn;
}

function anchorEvent(turn: TurnEntity): EventEntity {
    const event = new EventEntity();
    event.id = "anchor-1";
    event.seq = "1";
    event.userId = "u1";
    event.taskId = turn.taskId;
    event.sessionId = turn.sessionId;
    event.turnId = turn.id;
    event.kind = KIND.userMessage;
    event.lane = "implementation";
    event.title = "린트 돌려줘";
    event.body = null;
    event.toolName = null;
    event.filePaths = [];
    event.metadata = {};
    event.occurredAt = NOW;
    return event;
}

function lintEvent(turn: TurnEntity): EventEntity {
    const event = new EventEntity();
    event.id = "event-1";
    event.seq = "2";
    event.userId = "u1";
    event.taskId = turn.taskId;
    event.sessionId = turn.sessionId;
    event.turnId = turn.id;
    event.kind = KIND.executeTool;
    event.lane = "implementation";
    event.title = "Run lint";
    event.body = "$ npm run lint";
    event.toolName = null;
    event.filePaths = [];
    event.metadata = { [AGENT_TRACER_ATTR.command]: "npm run lint" };
    event.occurredAt = NOW;
    return event;
}

function makeService(turn: TurnEntity, events: readonly EventEntity[]) {
    const turnRepo = new InMemoryTurnRepository();
    const eventRepo = new InMemoryEventReader();
    const verdictRepo = new InMemoryVerdictRepository();
    turnRepo.seed(turn);
    eventRepo.seed(...events);
    const service = new RuleBackfillService(turnRepo, eventRepo, verdictRepo, new FixedClock(NOW));
    return { service, verdictRepo };
}

describe("RuleBackfillService", () => {
    it("규칙을 낳은 지난 턴에 소급 적용해 판정을 남긴다", async () => {
        const turn = pastTurn();
        const { service, verdictRepo } = makeService(turn, [anchorEvent(turn), lintEvent(turn)]);

        const reevaluated = await service.backfill(rule(RULE_REVIEW_STATE.active), "task-1");

        expect(reevaluated).toBe(1);
        expect(verdictRepo.all()).toMatchObject([
            { ruleId: "rule-1", turnId: turn.id, status: VERDICT_STATUS.satisfied },
        ]);
    });

    it("승인 대기 규칙은 소급 판정하지 않는다", async () => {
        const turn = pastTurn();
        const { service, verdictRepo } = makeService(turn, [anchorEvent(turn), lintEvent(turn)]);

        const reevaluated = await service.backfill(rule(RULE_REVIEW_STATE.pendingReview), "task-1");

        expect(reevaluated).toBe(0);
        expect(verdictRepo.all()).toHaveLength(0);
    });
});
