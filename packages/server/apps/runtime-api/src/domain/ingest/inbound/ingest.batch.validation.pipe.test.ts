import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { MIN_SUPPORTED_CONTRACT_VERSION } from "@monitor/kernel";
import type { BatchRejectedLog, IngestEventLog } from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";
import { IngestBatchValidationPipe } from "./ingest.batch.validation.pipe.js";

function makeGateLog(): { readonly gateLog: IngestGateLogService; readonly rejections: BatchRejectedLog[] } {
    const rejections: BatchRejectedLog[] = [];
    const ingestLog: IngestEventLog = {
        rejected: () => undefined,
        appended: () => undefined,
        appendFailed: () => undefined,
        allRejected: () => undefined,
        contractVersionRejected: () => undefined,
        batchRejected: (entry) => rejections.push(entry),
        rateLimited: () => undefined,
    };
    return { gateLog: new IngestGateLogService(ingestLog), rejections };
}

describe("IngestBatchValidationPipe", () => {
    it("유효한 배치는 그대로 통과시킨다", () => {
        const { gateLog } = makeGateLog();
        const pipe = new IngestBatchValidationPipe(gateLog);
        const body = {
            contractVersion: MIN_SUPPORTED_CONTRACT_VERSION,
            events: [{
                id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
                kind: "not.a.real.kind",
                taskId: "task-1",
                occurredAt: "2026-01-01T00:00:00.000Z",
                payload: {},
            }],
        };

        const result = pipe.transform(body);

        expect(result.accepted).toEqual([]);
        expect(result.rejected[0]!.reason).toContain("unknown event kind");
    });

    it("봉투 자체가 어긋나면 배치 전체를 거부하고 크기와 사유를 로그로 남긴다", () => {
        const { gateLog, rejections } = makeGateLog();
        const pipe = new IngestBatchValidationPipe(gateLog);

        expect(() => pipe.transform({ contractVersion: MIN_SUPPORTED_CONTRACT_VERSION, events: [] })).toThrow(
            BadRequestException,
        );

        expect(rejections).toHaveLength(1);
        expect(rejections[0]!.count).toBe(0);
        expect(rejections[0]!.reason.length).toBeGreaterThan(0);
    });

    it("본문이 객체가 아니면 배치 크기 없이 거부를 로그로 남긴다", () => {
        const { gateLog, rejections } = makeGateLog();
        const pipe = new IngestBatchValidationPipe(gateLog);

        expect(() => pipe.transform("not-an-object")).toThrow(BadRequestException);

        expect(rejections).toEqual([{ reason: rejections[0]!.reason, count: undefined }]);
    });
});
