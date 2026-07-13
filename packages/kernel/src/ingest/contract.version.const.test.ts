import { describe, expect, it } from "vitest";
import {
    contractVersionRejectionReason,
    isContractVersionSupported,
    UNKNOWN_CONTRACT_VERSION,
} from "./contract.version.const.js";

describe("isContractVersionSupported", () => {
    it("최소 버전과 같으면 지원한다", () => {
        expect(isContractVersionSupported("0.5.0", "0.5.0")).toBe(true);
    });

    it("최소 버전보다 patch가 높으면 지원한다", () => {
        expect(isContractVersionSupported("0.5.1", "0.5.0")).toBe(true);
    });

    it("최소 버전보다 minor가 높으면 지원한다", () => {
        expect(isContractVersionSupported("0.6.0", "0.5.0")).toBe(true);
    });

    it("최소 버전보다 낮으면 지원하지 않는다", () => {
        expect(isContractVersionSupported("0.4.9", "0.5.0")).toBe(false);
    });

    it("형식이 semver가 아니면 지원하지 않는다", () => {
        expect(isContractVersionSupported(UNKNOWN_CONTRACT_VERSION, "0.5.0")).toBe(false);
        expect(isContractVersionSupported("", "0.5.0")).toBe(false);
        expect(isContractVersionSupported("v1", "0.5.0")).toBe(false);
    });
});

describe("contractVersionRejectionReason", () => {
    it("실제 버전과 요구 버전을 사유 문자열에 담는다", () => {
        const reason = contractVersionRejectionReason("0.3.0", "0.5.0");
        expect(reason).toContain("0.3.0");
        expect(reason).toContain("0.5.0");
    });

    it("빈 버전은 unknown으로 표시한다", () => {
        expect(contractVersionRejectionReason("", "0.5.0")).toContain(UNKNOWN_CONTRACT_VERSION);
    });
});
