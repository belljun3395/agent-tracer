import { describe, expect, it, vi } from "vitest";
import { UpdateRuleUseCase } from "../update.rule.usecase.js";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IRuleEnforcementRepository } from "~application/ports/repository/rule.enforcement.repository.js";
import type { IRuleRepository, RuleUpdateInput, RuleWithSignature } from "~application/ports/repository/rule.repository.js";
import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";
import { computeRuleSignature } from "~domain/verification/index.js";

const baseRule: RuleWithSignature = {
    id: "rule-1",
    name: "Run tests",
    expect: { action: "command" },
    scope: "global",
    source: "human",
    severity: "info",
    rationale: "Old reason",
    signature: computeRuleSignature({ expect: { action: "command" } }),
    createdAt: "2026-04-27T10:00:00.000Z",
};

describe("UpdateRuleUseCase", () => {
    it("persists rationale-only updates without invalidating verdicts", async () => {
        let stored = baseRule;
        const ruleRepo: Pick<IRuleRepository, "findById" | "update"> = {
            findById: vi.fn(async () => stored),
            update: vi.fn(async (_id: string, patch: RuleUpdateInput, newSignature: string) => {
                const next = { ...stored, signature: newSignature };
                if (patch.rationale === null) {
                    const { rationale: _rationale, ...withoutRationale } = next;
                    stored = withoutRationale;
                } else {
                    stored = {
                        ...next,
                        ...(patch.rationale !== undefined ? { rationale: patch.rationale } : {}),
                    };
                }
                return stored;
            }),
        };
        const verdictRepo: Pick<IVerdictRepository, "deleteByRuleId"> = {
            deleteByRuleId: vi.fn(async () => undefined),
        };
        const enforcementRepo: Pick<IRuleEnforcementRepository, "deleteByRuleId"> = {
            deleteByRuleId: vi.fn(async () => undefined),
        };
        const notifier: INotificationPublisher = {
            publish: vi.fn(),
        };
        const useCase = new UpdateRuleUseCase(
            ruleRepo as IRuleRepository,
            verdictRepo as IVerdictRepository,
            enforcementRepo as IRuleEnforcementRepository,
            notifier,
        );

        const result = await useCase.execute({
            id: "rule-1",
            rationale: "Updated reason",
        });

        expect(result.rule.rationale).toBe("Updated reason");
        expect(result.signatureChanged).toBe(false);
        expect(verdictRepo.deleteByRuleId).not.toHaveBeenCalled();
        expect(enforcementRepo.deleteByRuleId).not.toHaveBeenCalled();
    });
});
