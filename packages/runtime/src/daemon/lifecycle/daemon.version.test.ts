import {describe, expect, it} from "vitest";
import {isContractVersionSupported, MIN_SUPPORTED_CONTRACT_VERSION} from "@monitor/kernel";
import {resolveDaemonVersion} from "~runtime/daemon/lifecycle/daemon.health.js";
import {isDaemonOutdated} from "~runtime/daemon/lifecycle/daemon.version.js";

describe("resolveDaemonVersion", () => {
    it("데몬이 인제스트에 실어 보내는 계약 버전이라 서버가 받는 하한을 넘어야 한다", () => {
        const version = resolveDaemonVersion();

        expect(isContractVersionSupported(version)).toBe(true);
    });

    it("계약 버전 하한을 스스로 만족하지 못하면 이벤트가 전량 거부된다", () => {
        expect(isContractVersionSupported("0.1.0", MIN_SUPPORTED_CONTRACT_VERSION)).toBe(false);
    });
});

describe("isDaemonOutdated", () => {
    it("훅이 더 높으면 데몬을 내린다", () => {
        expect(isDaemonOutdated("0.6.0", "0.5.7")).toBe(true);
    });

    it("훅이 더 낮으면 이미 도는 데몬을 그대로 둔다", () => {
        expect(isDaemonOutdated("0.1.0", "0.5.7")).toBe(false);
    });

    it("데몬 버전을 알 수 없으면 내리고 다시 띄운다", () => {
        expect(isDaemonOutdated("0.6.0", "unknown")).toBe(true);
    });
});
