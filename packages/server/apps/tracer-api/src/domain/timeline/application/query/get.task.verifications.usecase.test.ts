import { describe, expect, it } from "vitest";
import { VERDICT_STATUS, type VerdictEvidence } from "@monitor/kernel";
import { RuleEntity, TaskEntity, TurnEntity, VerdictEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryTaskReader } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.rule.task.reader.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.verdict.repository.js";
import { GetTaskVerificationsUseCase } from "./get.task.verifications.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeTask(id: string, userId: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    task.title = "제목";
    task.slug = id;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = "/repo";
    task.cliSource = null;
    task.parentTaskId = null;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = NOW;
    task.updatedAt = NOW;
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

function makeRule(id: string, userId: string, taskId: string, name: string): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = userId;
    rule.name = name;
    rule.expectation = { kind: "action", tool: "command" };
    rule.taskId = taskId;
    rule.source = "agent";
    rule.severity = "warn";
    rule.rationale = null;
    rule.signature = `sig-${id}`;
    rule.userEdited = false;
    rule.reviewState = "active";
    rule.lastEditedBy = "agent";
    rule.rev = 1;
    rule.sourceJobId = null;
    rule.createdAt = NOW;
    rule.deletedAt = null;
    return rule;
}

function evidence(triggerEventId: string, fulfilledEventIds: readonly string[]): VerdictEvidence {
    return {
        actualToolCalls: [],
        matchedToolCalls: [],
        enforcements: [
            { eventId: triggerEventId, matchKind: "trigger", decidedAt: NOW.toISOString() },
            ...fulfilledEventIds.map((eventId) => ({
                eventId,
                matchKind: "expect-fulfilled" as const,
                decidedAt: NOW.toISOString(),
            })),
        ],
    };
}

function makeUseCase(args: {
    readonly tasks: readonly TaskEntity[];
    readonly turns: readonly TurnEntity[];
    readonly verdicts: readonly VerdictEntity[];
    readonly rules: readonly RuleEntity[];
}): GetTaskVerificationsUseCase {
    const tasks = new InMemoryTaskReader();
    tasks.seed(...args.tasks);
    const turns = new InMemoryTurnRepository();
    turns.seed(...args.turns);
    const verdicts = new InMemoryVerdictRepository();
    verdicts.seed(...args.verdicts);
    const rules = new InMemoryRuleRepository();
    rules.seed(...args.rules);
    return new GetTaskVerificationsUseCase(tasks, turns, verdicts, rules);
}

describe("GetTaskVerificationsUseCase", () => {
    it("verified 판정만 골라 트리거와 이행 이벤트를 연결한다", async () => {
        const turn = TurnEntity.open("s1", "t1", 0, "배포해줘", NOW);
        turn.id = "turn-1";
        const verified = VerdictEntity.record(
            "turn-1",
            "rule-1",
            VERDICT_STATUS.verified,
            evidence("ev-trigger", ["ev-ok"]),
            NOW,
        );
        const contradicted = VerdictEntity.record(
            "turn-1",
            "rule-2",
            VERDICT_STATUS.contradicted,
            evidence("ev-trigger", []),
            NOW,
        );
        const useCase = makeUseCase({
            tasks: [makeTask("t1", "u1")],
            turns: [turn],
            verdicts: [verified, contradicted],
            rules: [makeRule("rule-1", "u1", "t1", "배포 규칙")],
        });

        const result = await useCase.execute("u1", "t1");

        expect(result).toEqual([
            {
                id: "turn-1:rule-1",
                taskId: "t1",
                ruleId: "rule-1",
                ruleName: "배포 규칙",
                turnId: "turn-1",
                evaluatedAt: NOW.toISOString(),
                triggerEventId: "ev-trigger",
                matchedEventIds: ["ev-ok"],
            },
        ]);
    });

    it("verified 판정이 없으면 빈 목록을 낸다", async () => {
        const turn = TurnEntity.open("s1", "t1", 0, "배포해줘", NOW);
        turn.id = "turn-1";
        const useCase = makeUseCase({
            tasks: [makeTask("t1", "u1")],
            turns: [turn],
            verdicts: [
                VerdictEntity.record("turn-1", "rule-1", VERDICT_STATUS.contradicted, evidence("ev-1", []), NOW),
            ],
            rules: [makeRule("rule-1", "u1", "t1", "배포 규칙")],
        });

        const result = await useCase.execute("u1", "t1");

        expect(result).toEqual([]);
    });

    it("남의 태스크는 존재 여부도 드러내지 않는다", async () => {
        const useCase = makeUseCase({
            tasks: [makeTask("t1", "u2")],
            turns: [],
            verdicts: [],
            rules: [],
        });

        const result = await useCase.execute("u1", "t1");

        expect(result).toBeNull();
    });
});
