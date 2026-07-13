import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { AiJobEntity } from "./ai.job.entity.js";
import { InvariantViolationError } from "../error/invariant.error.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("AiJobEntity", () => {
    describe("create", () => {
        it("kind에 맞는 executor를 배정하고 pending 상태로 만든다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            expect(job.status).toBe(JOB_STATUS.pending);
            expect(job.executor).toBe("local");
            expect(job.attempts).toBe(0);
        });

        it("temporal 실행 종류는 executor가 temporal이다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            expect(job.executor).toBe("temporal");
        });

        it("input에 taskId가 있으면 컬럼으로 승격한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, { taskId: "task-1" }, NOW);
            expect(job.taskId).toBe("task-1");
        });

        it("input에 taskId가 없으면 null이다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.titleSuggestion, {}, NOW);
            expect(job.taskId).toBeNull();
        });
    });

    describe("start", () => {
        it("대기 중인 잡을 시작하면 running이 되고 시작 시각이 기록된다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            const startedAt = new Date("2026-01-01T00:01:00.000Z");
            job.start(startedAt);
            expect(job.status).toBe(JOB_STATUS.running);
            expect(job.startedAt).toEqual(startedAt);
            expect(job.attempts).toBe(1);
        });

        it("이미 running인 잡을 다시 시작하면 시도 횟수만 늘리고 시작 시각은 유지한다(Temporal 재시도 재진입)", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            const firstStart = new Date("2026-01-01T00:01:00.000Z");
            job.start(firstStart);
            job.start(new Date("2026-01-01T00:02:00.000Z"));
            expect(job.status).toBe(JOB_STATUS.running);
            expect(job.startedAt).toEqual(firstStart);
            expect(job.attempts).toBe(2);
        });

        it("완료된 잡을 시작하려 하면 예외를 던진다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            job.start(NOW);
            job.complete({}, {}, NOW);
            expect(() => job.start(NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("complete", () => {
        it("결과와 사용량을 기록하고 completed로 전이한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            job.start(NOW);
            const completedAt = new Date("2026-01-01T00:05:00.000Z");
            job.complete({ ok: true }, { tokens: 100 }, completedAt);
            expect(job.status).toBe(JOB_STATUS.completed);
            expect(job.result).toEqual({ ok: true });
            expect(job.completedAt).toEqual(completedAt);
        });
    });

    describe("fail", () => {
        it("에러 메시지를 기록하고 failed로 전이한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            job.start(NOW);
            job.fail("boom", new Date("2026-01-01T00:05:00.000Z"));
            expect(job.status).toBe(JOB_STATUS.failed);
            expect(job.error).toBe("boom");
        });
    });

    describe("recordAttemptUsage", () => {
        it("상태를 바꾸지 않고 사용량만 누적한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            const recordedAt = new Date("2026-01-01T00:03:00.000Z");
            job.recordAttemptUsage({ attempts: [{ attempt: 1, status: "failed" }] }, recordedAt);
            expect(job.status).toBe(JOB_STATUS.running);
            expect(job.usage).toEqual({ attempts: [{ attempt: 1, status: "failed" }] });
            expect(job.updatedAt).toEqual(recordedAt);
        });

        it("이미 종료된 잡은 예외를 던진다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.fail("boom", NOW);
            expect(() => job.recordAttemptUsage({}, NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("cancel", () => {
        it("대기 중인 잡을 취소하면 canceled로 전이하고 종료 시각을 기록한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            const canceledAt = new Date("2026-01-01T00:03:00.000Z");
            job.cancel(canceledAt);
            expect(job.status).toBe(JOB_STATUS.canceled);
            expect(job.completedAt).toEqual(canceledAt);
        });

        it("실행 중인 잡도 취소할 수 있다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.cancel(NOW);
            expect(job.status).toBe(JOB_STATUS.canceled);
        });

        it("이미 종료된 잡은 취소할 수 없다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.complete({}, {}, NOW);
            expect(() => job.cancel(NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("종료된 잡의 재전이", () => {
        it("취소된 잡을 완료시키려 하면 예외를 던진다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.cancel(NOW);
            expect(() => job.complete({}, {}, NOW)).toThrow(InvariantViolationError);
        });

        it("취소된 잡을 실패시키려 하면 예외를 던진다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.cancel(NOW);
            expect(() => job.fail("boom", NOW)).toThrow(InvariantViolationError);
        });
    });

    describe("isTerminal", () => {
        it("completed는 종료 상태다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            job.start(NOW);
            job.complete({}, {}, NOW);
            expect(job.isTerminal()).toBe(true);
        });

        it("pending은 종료 상태가 아니다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            expect(job.isTerminal()).toBe(false);
        });

        it("canceled는 종료 상태다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            job.cancel(NOW);
            expect(job.isTerminal()).toBe(true);
        });
    });

    describe("isCancelable", () => {
        it("대기 중인 잡은 취소 가능하다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            expect(job.isCancelable()).toBe(true);
        });

        it("실패한 잡은 취소 가능하지 않다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            job.start(NOW);
            job.fail("boom", NOW);
            expect(job.isCancelable()).toBe(false);
        });
    });

    describe("runsLocally", () => {
        it("local executor 잡은 true를 반환한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.ruleGeneration, {}, NOW);
            expect(job.runsLocally()).toBe(true);
        });

        it("temporal executor 잡은 false를 반환한다", () => {
            const job = AiJobEntity.create("u1", JOB_KIND.recipeScan, {}, NOW);
            expect(job.runsLocally()).toBe(false);
        });
    });
});
