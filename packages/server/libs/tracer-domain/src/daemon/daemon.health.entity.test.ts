import { describe, expect, it } from "vitest";
import { DaemonHealthEntity } from "./daemon.health.entity.js";

describe("DaemonHealthEntity", () => {
    describe("fromReport", () => {
        it("보고 필드를 그대로 엔티티에 채운다", () => {
            const now = new Date("2026-07-11T00:00:00.000Z");
            const entity = DaemonHealthEntity.fromReport(
                "local",
                {
                    spoolBacklogBytes: 1024,
                    deadLetterCount: 2,
                    lastDeadReasons: ["rejected 4xx"],
                    swallowedErrors: 3,
                    daemonVersion: "0.4.0",
                    retryStatusSince: null,
                },
                now,
            );
            expect(entity.userId).toBe("local");
            expect(entity.spoolBacklogBytes).toBe(1024);
            expect(entity.deadLetterCount).toBe(2);
            expect(entity.lastDeadReasons).toEqual(["rejected 4xx"]);
            expect(entity.swallowedErrors).toBe(3);
            expect(entity.daemonVersion).toBe("0.4.0");
            expect(entity.retryStatusSince).toBeNull();
            expect(entity.reportedAt).toBe(now);
        });

        it("retryStatusSince가 epoch ms면 Date로 변환한다", () => {
            const entity = DaemonHealthEntity.fromReport(
                "local",
                {
                    spoolBacklogBytes: 0,
                    deadLetterCount: 0,
                    lastDeadReasons: [],
                    swallowedErrors: 0,
                    daemonVersion: "0.4.0",
                    retryStatusSince: 1_720_000_000_000,
                },
                new Date(),
            );
            expect(entity.retryStatusSince).toEqual(new Date(1_720_000_000_000));
        });

        it("lastDeadReasons 배열을 복사해 원본 참조를 공유하지 않는다", () => {
            const reasons = ["poison after 3 server errors"];
            const entity = DaemonHealthEntity.fromReport(
                "local",
                {
                    spoolBacklogBytes: 0,
                    deadLetterCount: 1,
                    lastDeadReasons: reasons,
                    swallowedErrors: 0,
                    daemonVersion: "0.4.0",
                    retryStatusSince: null,
                },
                new Date(),
            );
            reasons.push("mutated after construction");
            expect(entity.lastDeadReasons).toEqual(["poison after 3 server errors"]);
        });
    });
});
