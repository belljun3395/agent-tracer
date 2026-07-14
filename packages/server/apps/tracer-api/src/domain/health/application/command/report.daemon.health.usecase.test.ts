import { describe, expect, it } from "vitest";
import { InMemoryDaemonHealthRepository } from "~tracer-api/domain/health/port/__fakes__/in-memory.daemon.health.repository.js";
import { FixedClock } from "~tracer-api/domain/health/port/__fakes__/fixed.clock.js";
import { ReportDaemonHealthUseCase } from "./report.daemon.health.usecase.js";

function makeUseCase() {
    const repo = new InMemoryDaemonHealthRepository();
    return { useCase: new ReportDaemonHealthUseCase(repo, new FixedClock(new Date("2026-01-01T00:00:00.000Z"))), repo };
}

describe("ReportDaemonHealthUseCase", () => {
    it("첫 보고를 사용자별 새 행으로 저장한다", async () => {
        const { useCase, repo } = makeUseCase();
        const result = await useCase.execute("local", {
            spoolBacklogBytes: 100,
            deadLetterCount: 1,
            lastDeadReasons: ["rejected 4xx"],
            swallowedErrors: 2,
            daemonVersion: "0.4.0",
            retryStatusSince: null,
        });

        expect(result.snapshot.spoolBacklogBytes).toBe(100);
        expect(result.snapshot.deadLetterCount).toBe(1);
        expect(result.snapshot.lastDeadReasons).toEqual(["rejected 4xx"]);
        expect(repo.all()).toHaveLength(1);
    });

    it("같은 사용자의 재보고는 기존 행을 덮어쓴다", async () => {
        const { useCase, repo } = makeUseCase();
        await useCase.execute("local", {
            spoolBacklogBytes: 100,
            deadLetterCount: 1,
            lastDeadReasons: [],
            swallowedErrors: 0,
            daemonVersion: "0.4.0",
            retryStatusSince: null,
        });
        await useCase.execute("local", {
            spoolBacklogBytes: 200,
            deadLetterCount: 3,
            lastDeadReasons: ["poison after 3 server errors"],
            swallowedErrors: 5,
            daemonVersion: "0.4.1",
            retryStatusSince: 1_720_000_000_000,
        });

        expect(repo.all()).toHaveLength(1);
        const result = await useCase.execute("local", {
            spoolBacklogBytes: 200,
            deadLetterCount: 3,
            lastDeadReasons: ["poison after 3 server errors"],
            swallowedErrors: 5,
            daemonVersion: "0.4.1",
            retryStatusSince: 1_720_000_000_000,
        });
        expect(result.snapshot.spoolBacklogBytes).toBe(200);
        expect(result.snapshot.retryStatusSince).toBe(new Date(1_720_000_000_000).toISOString());
    });

    it("보고 시각을 ISO 문자열로 반환한다", async () => {
        const { useCase } = makeUseCase();
        const result = await useCase.execute("local", {
            spoolBacklogBytes: 0,
            deadLetterCount: 0,
            lastDeadReasons: [],
            swallowedErrors: 0,
            daemonVersion: "0.4.0",
            retryStatusSince: null,
        });
        expect(() => new Date(result.snapshot.reportedAt).toISOString()).not.toThrow();
    });
});
