import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {readAgentTracerConfig, writeAgentTracerConfig} from "~runtime/config/config.store.js";

let tmp: string;
let paths: AgentTracerPaths;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "config-store-test-"));
    paths = resolveAgentTracerPaths({HOME: tmp});
    fs.mkdirSync(paths.homeDir, {recursive: true});
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("config.json 전체 레코드", () => {
    it("파일이 없으면 빈 레코드다", () => {
        expect(readAgentTracerConfig(paths)).toEqual({});
    });

    it("파싱에 실패하면 빈 레코드다", () => {
        fs.writeFileSync(paths.configPath, "{not json", {mode: 0o600});

        expect(readAgentTracerConfig(paths)).toEqual({});
    });

    it("머지 쓰기가 기존 키를 보존한다", () => {
        writeAgentTracerConfig({userId: "me@example.com", baseUrl: "http://127.0.0.1:3847"}, paths);

        writeAgentTracerConfig({daemon: {controlPort: 4000}}, paths);

        expect(readAgentTracerConfig(paths)).toEqual({
            userId: "me@example.com",
            baseUrl: "http://127.0.0.1:3847",
            daemon: {controlPort: 4000},
        });
    });

    it("같은 키를 다시 쓰면 새 값으로 덮는다", () => {
        writeAgentTracerConfig({userId: "a@example.com"}, paths);

        writeAgentTracerConfig({userId: "b@example.com"}, paths);

        expect(readAgentTracerConfig(paths)).toEqual({userId: "b@example.com"});
    });

    it("파일 권한을 0o600으로 쓴다", () => {
        writeAgentTracerConfig({userId: "a@example.com"}, paths);

        const mode = fs.statSync(paths.configPath).mode & 0o777;
        expect(mode).toBe(0o600);
    });
});
