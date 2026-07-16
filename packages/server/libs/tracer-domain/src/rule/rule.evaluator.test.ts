import { describe, expect, it } from "vitest";
import {
    AGENT_TRACER_ATTR,
    KIND,
    RULE_EXPECTATION_KIND,
    RULE_SEVERITY,
    VERDICT_STATUS,
    type RuleExpectation,
} from "@monitor/kernel";
import { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import { RuleEntity } from "./rule.entity.js";
import { RuleEvaluator, type RuleEvaluationPorts } from "./rule.evaluator.js";
import { RuleVerification } from "./verification/rule.verification.domain.js";
import type { VerdictEntity } from "./verification/verdict.entity.js";
import type { TurnEntity } from "../timeline/turn/turn.entity.js";

const NOW = new Date("2026-01-01T00:10:00.000Z");
const TASK = "task-1";
const ANCHOR = "anchor-1";

function makeRule(expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = "rule-1";
    rule.userId = "u1";
    rule.expectation = expectation;
    rule.taskId = TASK;
    rule.anchorEventId = ANCHOR;
    rule.severity = RULE_SEVERITY.block;
    rule.deletedAt = null;
    return rule;
}

function makeEvent(id: string, seq: string, kind: string, metadata: Record<string, unknown> = {}): EventEntity {
    const event = new EventEntity();
    event.id = id;
    event.seq = seq;
    event.userId = "u1";
    event.taskId = TASK;
    event.sessionId = "session-1";
    event.turnId = "turn-x";
    event.kind = kind as EventEntity["kind"];
    event.lane = "implementation";
    event.title = id;
    event.body = null;
    event.toolName = null;
    event.filePaths = [];
    event.metadata = metadata;
    event.occurredAt = NOW;
    return event;
}

const anchor = () => makeEvent(ANCHOR, "1", KIND.userMessage);
const npmTest = (id: string, seq: string) =>
    makeEvent(id, seq, KIND.executeTool, { [AGENT_TRACER_ATTR.command]: "npm test" });
const otherCmd = (id: string, seq: string) =>
    makeEvent(id, seq, KIND.executeTool, { [AGENT_TRACER_ATTR.command]: "npm run build" });
const opaque = (id: string, seq: string) => makeEvent(id, seq, KIND.executeTool, {});

function makeTurn(id: string): TurnEntity {
    return { id, taskId: TASK, recordVerdictSummary() {} } as unknown as TurnEntity;
}

/** findByTaskSinceEvent 호출 횟수를 세는 이벤트 포트 대역이며, 현재 ledger 상태를 그대로 창으로 준다. */
class FakeEvents {
    windowCalls = 0;
    constructor(private readonly events: EventEntity[]) {}

    private window(taskId: string, anchorId: string): EventEntity[] {
        const found = this.events.find((e) => e.id === anchorId);
        if (found === undefined) return [];
        return this.events
            .filter((e) => e.taskId === taskId && BigInt(e.seq) >= BigInt(found.seq))
            .sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));
    }

    findByTaskSinceEvent(taskId: string, anchorId: string): Promise<EventEntity[]> {
        this.windowCalls += 1;
        return Promise.resolve(this.window(taskId, anchorId));
    }

    maxSeqSinceEvent(taskId: string, anchorId: string): Promise<string | null> {
        return Promise.resolve(this.window(taskId, anchorId).at(-1)?.seq ?? null);
    }
}

class FakeVerdicts {
    stored: VerdictEntity | null = null;
    findByRule(ruleId: string): Promise<VerdictEntity | null> {
        return Promise.resolve(this.stored !== null && this.stored.ruleId === ruleId ? this.stored : null);
    }
    findByTurn(turnId: string): Promise<VerdictEntity[]> {
        return Promise.resolve(this.stored !== null && this.stored.turnId === turnId ? [this.stored] : []);
    }
    upsert(verdict: VerdictEntity): Promise<void> {
        this.stored = verdict;
        return Promise.resolve();
    }
}

const fakeTurns = { upsert: () => Promise.resolve() };

function ports(events: FakeEvents, verdicts: FakeVerdicts): RuleEvaluationPorts {
    return { events, turns: fakeTurns, verdicts };
}

/** 매 턴 전체 창을 다시 읽어 판정을 전진시키는 참조 구현이며, 증분 경로가 이 결과와 일치해야 한다. */
function legacyRun(rule: RuleEntity, ledger: readonly EventEntity[][]): VerdictEntity | null {
    let current: VerdictEntity | null = null;
    const seen: EventEntity[] = [];
    let index = 0;
    for (const batch of ledger) {
        seen.push(...batch);
        const window = [...seen].sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));
        const verification = new RuleVerification(rule, window);
        index += 1;
        if (!verification.covers()) continue;
        const next = verification.advance(current, `turn-${index}`, NOW);
        if (next !== null) current = next;
    }
    return current;
}

async function optimizedRun(rule: RuleEntity, ledger: readonly EventEntity[][]): Promise<VerdictEntity | null> {
    const events = new FakeEvents([]);
    const verdicts = new FakeVerdicts();
    const evaluator = new RuleEvaluator(ports(events, verdicts));
    const live = (events as unknown as { events: EventEntity[] }).events;
    let index = 0;
    for (const batch of ledger) {
        live.push(...batch);
        index += 1;
        await evaluator.evaluate(rule, makeTurn(`turn-${index}`), NOW);
    }
    return verdicts.stored;
}

function evidenceOf(v: VerdictEntity | null) {
    return v === null ? null : { status: v.status, evidence: v.evidence };
}

describe("RuleEvaluator 증분 early-out", () => {
    it("종결된 판정은 창을 다시 읽지 않는다", async () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const events = new FakeEvents([anchor(), npmTest("e1", "2")]);
        const verdicts = new FakeVerdicts();
        // 이미 satisfied로 종결한 판정을 심는다.
        const seeded = new RuleVerification(rule, [anchor(), npmTest("e1", "2")]).advance(null, "turn-0", NOW);
        seeded!.markEvaluatedSeq("2");
        verdicts.stored = seeded;
        events.windowCalls = 0;

        const evaluator = new RuleEvaluator(ports(events, verdicts));
        const result = await evaluator.evaluate(rule, makeTurn("turn-1"), NOW);

        expect(result).toBeNull();
        expect(events.windowCalls).toBe(0);
        expect(verdicts.stored?.status).toBe(VERDICT_STATUS.satisfied);
    });

    it("마지막 평가 이후 새 이벤트가 없으면 열린 판정도 창을 다시 읽지 않는다", async () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const events = new FakeEvents([anchor()]);
        const verdicts = new FakeVerdicts();
        const seeded = new RuleVerification(rule, [anchor()]).advance(null, "turn-0", NOW);
        seeded!.markEvaluatedSeq("1");
        verdicts.stored = seeded;
        events.windowCalls = 0;

        const evaluator = new RuleEvaluator(ports(events, verdicts));
        const result = await evaluator.evaluate(rule, makeTurn("turn-1"), NOW);

        expect(result).toBeNull();
        expect(events.windowCalls).toBe(0);
        expect(verdicts.stored?.status).toBe(VERDICT_STATUS.open);
        expect(verdicts.stored?.turnId).toBe("turn-0");
    });

    it("새 이벤트가 도착하면 창을 읽어 판정을 전진시키고 high-water mark를 올린다", async () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const events = new FakeEvents([anchor()]);
        const verdicts = new FakeVerdicts();
        const seeded = new RuleVerification(rule, [anchor()]).advance(null, "turn-0", NOW);
        seeded!.markEvaluatedSeq("1");
        verdicts.stored = seeded;
        (events as unknown as { events: EventEntity[] }).events.push(npmTest("e1", "2"));
        events.windowCalls = 0;

        const evaluator = new RuleEvaluator(ports(events, verdicts));
        const result = await evaluator.evaluate(rule, makeTurn("turn-1"), NOW);

        expect(result).not.toBeNull();
        expect(events.windowCalls).toBe(1);
        expect(verdicts.stored?.status).toBe(VERDICT_STATUS.satisfied);
        expect(verdicts.stored?.lastEvaluatedSeq).toBe("2");
    });
});

describe("RuleEvaluator 증분 = 전체 윈도우 동등성", () => {
    const scenarios: { readonly name: string; readonly exp: RuleExpectation; readonly ledger: EventEntity[][] }[] = [
        {
            name: "이행이 늦게 도착해도 결국 satisfied이고, 이후 턴은 no-op이다",
            exp: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] },
            ledger: [[anchor()], [otherCmd("e1", "2")], [npmTest("e2", "3")], [otherCmd("e3", "4")]],
        },
        {
            name: "이행 증거가 끝내 없으면 판정은 열린 채 남는다",
            exp: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] },
            ledger: [[anchor()], [otherCmd("e1", "2")], [otherCmd("e2", "3")]],
        },
        {
            name: "분류 못 한 도구가 창을 얼리면 이후 이행 증거가 와도 unknown으로 굳는다",
            exp: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] },
            ledger: [[anchor(), opaque("e1", "2")], [npmTest("e2", "3")]],
        },
    ];

    for (const { name, exp, ledger } of scenarios) {
        it(name, async () => {
            const rule = makeRule(exp);
            const legacy = legacyRun(rule, ledger);
            const optimized = await optimizedRun(rule, ledger);
            expect(evidenceOf(optimized)).toEqual(evidenceOf(legacy));
        });
    }
});
