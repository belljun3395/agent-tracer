import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { isApiErrorEnvelope, MIN_SUPPORTED_CONTRACT_VERSION } from "@monitor/kernel";
import type { ContractVersionRejectedLog, IngestEventLog } from "~runtime-api/domain/ingest/port/ingest.event.log.port.js";
import { IngestGateLogService } from "~runtime-api/domain/ingest/application/ingest.gate.log.service.js";
import { CONTRACT_VERSION_REJECTED_CODE, ContractVersionPipe } from "./contract.version.pipe.js";

function makeGateLog(): { readonly gateLog: IngestGateLogService; readonly rejections: ContractVersionRejectedLog[] } {
    const rejections: ContractVersionRejectedLog[] = [];
    const ingestLog: IngestEventLog = {
        rejected: () => undefined,
        appended: () => undefined,
        appendFailed: () => undefined,
        allRejected: () => undefined,
        contractVersionRejected: (entry) => rejections.push(entry),
        batchRejected: () => undefined,
        rateLimited: () => undefined,
    };
    return { gateLog: new IngestGateLogService(ingestLog), rejections };
}

describe("ContractVersionPipe", () => {
    const { gateLog } = makeGateLog();
    const pipe = new ContractVersionPipe(gateLog);

    it("최소 지원 버전과 같은 contractVersion은 통과시킨다", () => {
        const body = { contractVersion: MIN_SUPPORTED_CONTRACT_VERSION, events: [] };

        expect(pipe.transform(body)).toBe(body);
    });

    it("최소 지원 버전보다 높은 contractVersion은 통과시킨다", () => {
        const [major, minor, patch] = MIN_SUPPORTED_CONTRACT_VERSION.split(".").map(Number);
        const body = { contractVersion: `${major}.${minor}.${(patch ?? 0) + 1}`, events: [] };

        expect(pipe.transform(body)).toBe(body);
    });

    it("최소 지원 버전보다 낮은 contractVersion은 구조화된 사유로 거부한다", () => {
        try {
            pipe.transform({ contractVersion: "0.1.0", events: [] });
            expect.unreachable("거부돼야 한다");
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (error as BadRequestException).getResponse();
            expect(isApiErrorEnvelope(response)).toBe(true);
            if (isApiErrorEnvelope(response)) {
                expect(response.error.code).toBe(CONTRACT_VERSION_REJECTED_CODE);
                expect(response.error.message).toContain("0.1.0");
                expect(response.error.message).toContain(MIN_SUPPORTED_CONTRACT_VERSION);
            }
        }
    });

    it("거부하면 버전과 배치 크기를 로그로 남긴다", () => {
        const { gateLog: isolatedGateLog, rejections } = makeGateLog();
        const isolatedPipe = new ContractVersionPipe(isolatedGateLog);

        expect(() => isolatedPipe.transform({ contractVersion: "0.1.0", events: [{}, {}] })).toThrow();

        expect(rejections).toEqual([{ contractVersion: "0.1.0", count: 2 }]);
    });

    it("contractVersion이 없으면 unknown으로 취급해 거부한다", () => {
        try {
            pipe.transform({ events: [] });
            expect.unreachable("거부돼야 한다");
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (error as BadRequestException).getResponse();
            expect(isApiErrorEnvelope(response) && response.error.message).toContain("unknown");
        }
    });

    it("본문이 객체가 아니어도 예외 없이 unknown으로 취급해 거부한다", () => {
        expect(() => pipe.transform("not-an-object")).toThrow(BadRequestException);
    });
});
