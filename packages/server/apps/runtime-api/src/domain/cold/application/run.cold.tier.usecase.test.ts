import { describe, expect, it } from "vitest";
import { InMemoryIngestKeyRetention } from "../port/__fakes__/in-memory.ingest.key.retention.js";
import { InMemoryPartitionArchive } from "../port/__fakes__/in-memory.partition.archive.js";
import { RunColdTierUsecase } from "./run.cold.tier.usecase.js";

describe("RunColdTierUsecase", () => {
    it("보관한 파티션과 지운 수집 키를 함께 보고한다", async () => {
        const archive = new InMemoryPartitionArchive([
            { partition: "events_p2026_01", location: "s3://cold/events/events_p2026_01.parquet" },
        ]);
        const retention = new InMemoryIngestKeyRetention(["expired-1", "expired-2"]);

        const run = await new RunColdTierUsecase(archive, retention).execute();

        expect(run.archived.map((entry) => entry.partition)).toEqual(["events_p2026_01"]);
        expect(run.prunedIngestKeys).toBe(2);
        expect(archive.remaining()).toEqual([]);
        expect(retention.remaining()).toEqual([]);
    });

    it("파티션 보관이 실패하면 수집 키 보존을 실행하지 않는다", async () => {
        const archive = new InMemoryPartitionArchive();
        archive.failWith(new Error("minio unavailable"));
        const retention = new InMemoryIngestKeyRetention(["expired-1"]);

        await expect(new RunColdTierUsecase(archive, retention).execute()).rejects.toThrow("minio unavailable");

        expect(retention.callCount()).toBe(0);
        expect(retention.remaining()).toEqual(["expired-1"]);
    });
});
