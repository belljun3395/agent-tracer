import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IRulePersistence, RulePersistenceRecord } from "./outbound/rule.persistence.port.js";
import type {
    IRuleNotificationPublisher,
    RuleOutboundNotification,
} from "./outbound/notification.publisher.port.js";
import { RuleNotFoundError } from "../common/errors.js";

const NOW_ISO = "2026-04-29T10:00:00.000Z";

function record(overrides: Partial<RulePersistenceRecord> = {}): RulePersistenceRecord {
    return {
        id: "r-1",
        name: "rule",
        expect: { action: "command" },
        scope: "global",
        source: "human",
        severity: "info",
        signature: "sig",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function setup(opts: { found?: RulePersistenceRecord | null; softDeleteOk?: boolean } = {}) {
    const ruleRepo = {
        findById: vi.fn(async () => opts.found ?? null),
        softDelete: vi.fn(async () => opts.softDeleteOk ?? true),
        findBySignature: vi.fn(),
        findActiveForTurn: vi.fn(),
        list: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    } as unknown as IRulePersistence & { findById: Mock; softDelete: Mock };

    const calls: RuleOutboundNotification[] = [];
    const notifier: IRuleNotificationPublisher & { publish: Mock } = {
        publish: vi.fn((n) => { calls.push(n); }),
    };
    const clock: IClock & { nowIso: Mock; nowMs: Mock } = {
        nowMs: vi.fn(() => Date.parse(NOW_ISO)),
        nowIso: vi.fn(() => NOW_ISO),
    };

    const usecase = new DeleteRuleUseCase(ruleRepo, notifier, clock);
    return { usecase, ruleRepo, notifier, calls, clock };
}

describe("DeleteRuleUseCase", () => {
    it("throws RuleNotFoundError when the rule does not exist (no soft-delete, no notification)", async () => {
        const h = setup({ found: null });

        await expect(h.usecase.execute("r-missing")).rejects.toBeInstanceOf(RuleNotFoundError);
        expect(h.ruleRepo.softDelete).not.toHaveBeenCalled();
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });

    it("passes IClock.nowIso() as the soft-delete timestamp (deterministic)", async () => {
        const h = setup({ found: record({ scope: "task", taskId: "t-1" }) });

        await h.usecase.execute("r-1");

        expect(h.ruleRepo.softDelete).toHaveBeenCalledWith("r-1", NOW_ISO);
    });

    it("publishes rules.changed { change: 'deleted' } including taskId when present", async () => {
        const h = setup({ found: record({ scope: "task", taskId: "t-9" }) });

        await h.usecase.execute("r-1");

        expect(h.calls).toEqual([
            {
                type: "rules.changed",
                payload: { ruleId: "r-1", change: "deleted", scope: "task", taskId: "t-9" },
            },
        ]);
    });

    it("throws RuleNotFoundError when softDelete reports no row affected (race-after-find-by-id)", async () => {
        const h = setup({ found: record(), softDeleteOk: false });

        await expect(h.usecase.execute("r-1")).rejects.toBeInstanceOf(RuleNotFoundError);
        expect(h.notifier.publish).not.toHaveBeenCalled();
    });
});
