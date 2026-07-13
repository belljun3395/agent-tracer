import { describe, expect, it } from "vitest";
import { DaemonHealthEntity } from "@monitor/tracer-domain";
import { InMemoryDaemonHealthRepository } from "~tracer-api/domain/health/port/__fakes__/in-memory.daemon.health.repository.js";
import { GetDaemonHealthUseCase } from "./get.daemon.health.usecase.js";

function makeUseCase(seed: DaemonHealthEntity[] = []) {
    const repo = new InMemoryDaemonHealthRepository();
    repo.seed(...seed);
    return new GetDaemonHealthUseCase(repo);
}

describe("GetDaemonHealthUseCase", () => {
    it("보고 이력이 없으면 null 스냅샷을 반환한다", async () => {
        const useCase = makeUseCase();
        const result = await useCase.execute("local");
        expect(result.snapshot).toBeNull();
    });

    it("사용자의 최신 보고를 스냅샷으로 반환한다", async () => {
        const entity = DaemonHealthEntity.fromReport(
            "local",
            {
                spoolBacklogBytes: 512,
                deadLetterCount: 2,
                lastDeadReasons: ["rejected 4xx"],
                swallowedErrors: 1,
                daemonVersion: "0.4.0",
                retryStatusSince: null,
            },
            new Date("2026-07-11T00:00:00.000Z"),
        );
        const useCase = makeUseCase([entity]);
        const result = await useCase.execute("local");
        expect(result.snapshot).toEqual({
            spoolBacklogBytes: 512,
            deadLetterCount: 2,
            lastDeadReasons: ["rejected 4xx"],
            swallowedErrors: 1,
            daemonVersion: "0.4.0",
            retryStatusSince: null,
            reportedAt: "2026-07-11T00:00:00.000Z",
        });
    });

    it("다른 사용자의 보고는 반환하지 않는다", async () => {
        const entity = DaemonHealthEntity.fromReport(
            "other-user",
            {
                spoolBacklogBytes: 0,
                deadLetterCount: 0,
                lastDeadReasons: [],
                swallowedErrors: 0,
                daemonVersion: "0.4.0",
                retryStatusSince: null,
            },
            new Date(),
        );
        const useCase = makeUseCase([entity]);
        const result = await useCase.execute("local");
        expect(result.snapshot).toBeNull();
    });
});
