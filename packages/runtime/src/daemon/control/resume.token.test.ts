import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {ensureAgentTracerHome, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {ensureResumeToken} from "~runtime/daemon/control/resume.token.js";

let tmp: string;
let paths: AgentTracerPaths;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resume-token-test-"));
    paths = resolveAgentTracerPaths({HOME: tmp});
    ensureAgentTracerHome(paths);
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("ensureResumeToken", () => {
    it("토큰 파일이 없으면 새로 발급하고 0600 권한으로 저장한다", () => {
        const token = ensureResumeToken(paths);

        expect(token.length).toBeGreaterThan(0);
        expect(fs.readFileSync(paths.resumeTokenPath, "utf8")).toBe(token);
        expect(fs.statSync(paths.resumeTokenPath).mode & 0o777).toBe(0o600);
    });

    it("이미 발급된 토큰 파일이 있으면 재사용한다", () => {
        const first = ensureResumeToken(paths);
        const second = ensureResumeToken(paths);

        expect(second).toBe(first);
    });
});
