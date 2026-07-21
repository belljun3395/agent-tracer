import { describe, expect, it } from "vitest";
import { combineLeases, ExecutionBudget } from "./agent.budget.js";

describe("ExecutionBudget", () => {
    it("share 1로 잔량 전부를 떼어 준다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        expect(budget.lease(1)).toEqual({ maxBudgetUsd: 2, maxTurns: 15 });
    });

    it("실제 지출을 반영해 잔량을 줄이고 다음 lease는 잔량만 받는다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        const firstLease = budget.lease(1);
        budget.settle(firstLease, { costUsd: 0.5, numTurns: 4 });

        expect(budget.lease(1)).toEqual({ maxBudgetUsd: 1.5, maxTurns: 11 });
    });

    it("실제 지출을 모르면 떼어 준 몫 전부를 쓴 것으로 본다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        const firstLease = budget.lease(1);
        budget.settle(firstLease, { costUsd: null, numTurns: null });

        expect(budget.lease(1)).toEqual({ maxBudgetUsd: 0, maxTurns: 0 });
    });

    it("잔량이 바닥나면 0을 그대로 드러낸다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 1, maxTurns: 5 });

        budget.settle(budget.lease(1), { costUsd: 1, numTurns: 5 });

        expect(budget.lease(1)).toEqual({ maxBudgetUsd: 0, maxTurns: 0 });
    });

    it("maxBudgetUsd가 없으면 lease와 settle 모두 undefined로 지나간다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 10 });

        const lease = budget.lease(1);
        budget.settle(lease, { costUsd: null, numTurns: 3 });

        expect(lease.maxBudgetUsd).toBeUndefined();
        expect(budget.lease(1)).toEqual({ maxBudgetUsd: undefined, maxTurns: 7 });
    });

    it("share가 범위를 벗어나면 거부한다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        expect(() => budget.lease(0)).toThrow(RangeError);
        expect(() => budget.lease(1.5)).toThrow(RangeError);
    });

    it("reserve가 즉시 잔량을 줄여 이후 lease가 예약분을 침범하지 못한다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        const reserved = budget.reserve(2, 0.2);
        expect(reserved).toEqual({ maxTurns: 2, maxBudgetUsd: 0.4 });

        expect(budget.lease(1)).toEqual({ maxTurns: 13, maxBudgetUsd: 1.6 });
    });

    it("첫 호출이 예산을 거의 다 써도 reserve로 떼어 둔 수리 몫은 살아남는다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        const repairLease = budget.reserve(2, 0.2);
        const firstLease = budget.lease(1);
        budget.settle(firstLease, { costUsd: firstLease.maxBudgetUsd ?? null, numTurns: firstLease.maxTurns });

        expect(repairLease.maxTurns).toBe(2);
        expect(budget.lease(1)).toEqual({ maxTurns: 0, maxBudgetUsd: 0 });
    });

    it("reserve 요청이 잔량을 넘으면 잔량만큼만 내주고 잔량을 0으로 남긴다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 1 });

        expect(budget.reserve(2)).toEqual({ maxTurns: 1, maxBudgetUsd: undefined });
        expect(budget.lease(1)).toEqual({ maxTurns: 0, maxBudgetUsd: undefined });
    });

    it("reserve는 turns나 budgetShare가 범위를 벗어나면 거부한다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        expect(() => budget.reserve(-1)).toThrow(RangeError);
        expect(() => budget.reserve(1, -0.1)).toThrow(RangeError);
        expect(() => budget.reserve(1, 1.1)).toThrow(RangeError);
    });

    it("leaseMany는 요청의 합이 몫 이하면 요청한 그대로 내준다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 3, maxTurns: 15 });

        expect(budget.leaseMany([2, 3], 1)).toEqual([
            { maxTurns: 2, maxBudgetUsd: 1.2 },
            { maxTurns: 3, maxBudgetUsd: 1.8 },
        ]);
    });

    it("leaseMany는 하나씩 lease를 부를 때 새던 나머지를 흘리지 않는다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 11 });

        // 셋에게 1/3씩 나눠 lease(1/3)를 세 번 부르면 floor(11/3)=3이 세 번, 합 9로 2턴이 증발했다.
        const leases = budget.leaseMany([4, 4, 4], 1);

        expect(leases.map((lease) => lease.maxTurns)).toEqual([4, 4, 3]);
        expect(leases.reduce((sum, lease) => sum + lease.maxTurns, 0)).toBe(11);
    });

    it("leaseMany는 요청이 몫을 넘으면 항목마다 최소 한 턴을 보장하며 비례로 줄인다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 6 });

        const leases = budget.leaseMany([5, 3, 2], 1);

        expect(leases.map((lease) => lease.maxTurns)).toEqual([3, 2, 1]);
        expect(leases.reduce((sum, lease) => sum + lease.maxTurns, 0)).toBe(6);
    });

    it("leaseMany는 항목 수가 배분 가능 턴보다 많으면 총량을 초과 발급하지 않는다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 10 });

        const requested = new Array(20).fill(3);
        const leases = budget.leaseMany(requested, 1);

        expect(leases).toHaveLength(20);
        expect(leases.reduce((sum, lease) => sum + lease.maxTurns, 0)).toBe(10);
        expect(leases.every((lease) => lease.maxTurns === 0 || lease.maxTurns === 1)).toBe(true);
    });

    it("leaseMany는 항목 수가 배분 가능 턴보다 많으면 많이 요구한 항목부터 1턴씩 남긴다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: undefined, maxTurns: 3 });

        const leases = budget.leaseMany([5, 1, 4, 2], 1);

        expect(leases.map((lease) => lease.maxTurns)).toEqual([1, 0, 1, 1]);
    });

    it("leaseMany는 share가 범위를 벗어나면 거부한다", () => {
        const budget = new ExecutionBudget({ maxBudgetUsd: 2, maxTurns: 15 });

        expect(() => budget.leaseMany([1, 1], 0)).toThrow(RangeError);
        expect(() => budget.leaseMany([1, 1], 1.5)).toThrow(RangeError);
    });
});

describe("combineLeases", () => {
    it("여러 몫의 턴과 비용을 더한다", () => {
        const combined = combineLeases([
            { maxTurns: 3, maxBudgetUsd: 0 },
            { maxTurns: 2, maxBudgetUsd: 0.54 },
        ]);

        expect(combined).toEqual({ maxTurns: 5, maxBudgetUsd: 0.54 });
    });

    it("하나라도 비용 상한이 없으면 합쳐진 몫도 상한이 없다고 본다", () => {
        const combined = combineLeases([
            { maxTurns: 3, maxBudgetUsd: undefined },
            { maxTurns: 2, maxBudgetUsd: 0.5 },
        ]);

        expect(combined).toEqual({ maxTurns: 5, maxBudgetUsd: undefined });
    });
});
