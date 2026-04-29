import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type {
    IRulePersistence,
    RulePersistenceInsertInput,
    RulePersistenceRecord,
} from "./outbound/rule.persistence.port.js";
import type { IRuleNotificationPublisher, RuleOutboundNotification } from "./outbound/notification.publisher.port.js";
import type { IBackfillTrigger } from "./outbound/backfill.trigger.port.js";
import { InvalidRuleError } from "../common/errors.js";

const NOW_ISO = "2026-04-29T10:00:00.000Z";

function setup() {
    const inserted: RulePersistenceInsertInput[] = [];
    const ruleRepo = {
        insert: vi.fn(async (input: RulePersistenceInsertInput): Promise<RulePersistenceRecord> => {
            inserted.push(input);
            return { ...input };
        }),
        findById: vi.fn(),
        findBySignature: vi.fn(),
        findActiveForTurn: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
    } as unknown as IRulePersistence & { insert: Mock };

    const calls: RuleOutboundNotification[] = [];
    const notifier: IRuleNotificationPublisher & { publish: Mock } = {
        publish: vi.fn((n) => { calls.push(n); }),
    };
    const backfill: IBackfillTrigger & { trigger: Mock } = {
        trigger: vi.fn(async () => ({ turnsConsidered: 0, turnsEvaluated: 0, verdictsCreated: 0 })),
    };
    const clock: IClock & { nowIso: Mock; nowMs: Mock } = {
        nowMs: vi.fn(() => Date.parse(NOW_ISO)),
        nowIso: vi.fn(() => NOW_ISO),
    };
    const idGen: IIdGenerator & { newUuid: Mock } = {
        newUuid: vi.fn(() => "rule-id-1"),
    };

    const usecase = new CreateRuleUseCase(ruleRepo, notifier, backfill, clock, idGen);
    return { usecase, ruleRepo, notifier, backfill, clock, idGen, inserted, calls };
}

describe("CreateRuleUseCase", () => {
    it("uses IIdGenerator.newUuid for rule id and IClock.nowIso for createdAt (deterministic)", async () => {
        const h = setup();

        const out = await h.usecase.execute({
            name: "block rm -rf",
            expect: { action: "command", commandMatches: ["rm -rf"] },
            scope: "global",
        });

        expect(h.idGen.newUuid).toHaveBeenCalledTimes(1);
        expect(h.clock.nowIso).toHaveBeenCalled();
        expect(h.inserted).toHaveLength(1);
        expect(h.inserted[0]!.id).toBe("rule-id-1");
        expect(h.inserted[0]!.createdAt).toBe(NOW_ISO);
        expect(out.rule.id).toBe("rule-id-1");
    });

    it("publishes rules.changed { change: 'created' } after insert", async () => {
        const h = setup();

        await h.usecase.execute({
            name: "x",
            expect: { action: "command" },
            scope: "global",
        });

        expect(h.calls).toEqual([
            {
                type: "rules.changed",
                payload: { ruleId: "rule-id-1", change: "created", scope: "global" },
            },
        ]);
    });

    it("fires backfill (fire-and-forget) with the persisted rule", async () => {
        const h = setup();

        await h.usecase.execute({
            name: "x",
            expect: { action: "command" },
            scope: "global",
        });

        expect(h.backfill.trigger).toHaveBeenCalledTimes(1);
        const arg = h.backfill.trigger.mock.calls[0]![0];
        expect(arg.rule.id).toBe("rule-id-1");
    });

    it("rejects empty name with InvalidRuleError (no insert, no notification)", async () => {
        const h = setup();

        await expect(
            h.usecase.execute({ name: "  ", expect: { action: "command" }, scope: "global" }),
        ).rejects.toBeInstanceOf(InvalidRuleError);

        expect(h.ruleRepo.insert).not.toHaveBeenCalled();
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });

    it("rejects scope='task' without a taskId", async () => {
        const h = setup();

        await expect(
            h.usecase.execute({ name: "x", expect: { action: "command" }, scope: "task" }),
        ).rejects.toBeInstanceOf(InvalidRuleError);
    });

    it("includes taskId in the changed-notification payload when scope is 'task'", async () => {
        const h = setup();

        await h.usecase.execute({
            name: "x",
            expect: { action: "command" },
            scope: "task",
            taskId: "t-9",
        });

        expect(h.calls[0]!.payload).toMatchObject({ scope: "task", taskId: "t-9" });
    });
});
