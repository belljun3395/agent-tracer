import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {writeAgentTracerConfig} from "~runtime/config/config.store.js";
import {
    DEFAULT_DAEMON_SETTINGS,
    resolveDaemonSettings,
    validateDaemonSettingsInput,
} from "~runtime/config/daemon.settings.js";

const NO_ENV: NodeJS.ProcessEnv = {};

let tmp: string;
let paths: AgentTracerPaths;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-settings-test-"));
    paths = resolveAgentTracerPaths({HOME: tmp});
    fs.mkdirSync(paths.homeDir, {recursive: true});
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("데몬 튜닝값 해석", () => {
    it("파일이 없으면 기본값으로 떨어진다", () => {
        expect(resolveDaemonSettings(NO_ENV, paths)).toEqual(DEFAULT_DAEMON_SETTINGS);
    });

    it("파일 값이 기본값을 이긴다", () => {
        writeAgentTracerConfig({daemon: {idleShutdownMs: 60_000, poisonAttempts: 5}}, paths);

        const settings = resolveDaemonSettings(NO_ENV, paths);

        expect(settings.idleShutdownMs).toBe(60_000);
        expect(settings.poisonAttempts).toBe(5);
        expect(settings.rulesRefreshMs).toBe(DEFAULT_DAEMON_SETTINGS.rulesRefreshMs);
    });

    it("범위 밖 파일 값은 방어적으로 기본값으로 떨어진다", () => {
        writeAgentTracerConfig({daemon: {controlPort: 0, spoolMaxBytes: -1, poisonAttempts: 3.5}}, paths);

        const settings = resolveDaemonSettings(NO_ENV, paths);

        expect(settings.controlPort).toBe(DEFAULT_DAEMON_SETTINGS.controlPort);
        expect(settings.spoolMaxBytes).toBe(DEFAULT_DAEMON_SETTINGS.spoolMaxBytes);
        expect(settings.poisonAttempts).toBe(DEFAULT_DAEMON_SETTINGS.poisonAttempts);
    });

    it("controlPort는 env가 파일을 이긴다", () => {
        writeAgentTracerConfig({daemon: {controlPort: 4000}}, paths);

        const settings = resolveDaemonSettings({AGENT_TRACER_RESUME_PORT: "5000"}, paths);

        expect(settings.controlPort).toBe(5000);
    });

    it("범위 밖 env 포트는 무시하고 파일 값을 쓴다", () => {
        writeAgentTracerConfig({daemon: {controlPort: 4000}}, paths);

        const settings = resolveDaemonSettings({AGENT_TRACER_RESUME_PORT: "0"}, paths);

        expect(settings.controlPort).toBe(4000);
    });
});

describe("데몬 튜닝값 입력 검증", () => {
    it("정상 입력은 그대로 값이 된다", () => {
        const result = validateDaemonSettingsInput(DEFAULT_DAEMON_SETTINGS);

        expect(result).toEqual({ok: true, value: DEFAULT_DAEMON_SETTINGS});
    });

    it("범위 밖 필드마다 오류 메시지를 낸다", () => {
        const result = validateDaemonSettingsInput({...DEFAULT_DAEMON_SETTINGS, controlPort: 0, poisonAttempts: 99});

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error("unreachable");
        expect(Object.keys(result.errors)).toEqual(["controlPort", "poisonAttempts"]);
    });

    it("객체가 아니면 모든 필드가 오류다", () => {
        const result = validateDaemonSettingsInput(null);

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error("unreachable");
        expect(Object.keys(result.errors)).toHaveLength(9);
    });
});
