import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {ensureSpoolDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {appendSpoolLines, enforceSpoolSizeCap, listSpoolSegments} from "~runtime/config/spool.js";

let tmp: string;
let paths: AgentTracerPaths;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spool-test-"));
    paths = resolveAgentTracerPaths({HOME: tmp});
    ensureSpoolDir(paths);
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("스풀 상한 강제", () => {
    it("maxBytes 미지정 시 기본 상한을 쓰므로 작은 세그먼트는 지워지지 않는다", () => {
        appendSpoolLines(["a"], paths, "seg-1");

        const result = enforceSpoolSizeCap(paths);

        expect(result.droppedSegments).toEqual([]);
        expect(listSpoolSegments(paths)).toHaveLength(1);
    });

    it("maxBytes를 지정하면 그 상한으로 오래된 세그먼트부터 지운다", () => {
        appendSpoolLines(["a".repeat(50)], paths, "seg-1");
        appendSpoolLines(["b".repeat(50)], paths, "seg-2");

        const result = enforceSpoolSizeCap(paths, 60);

        expect(result.droppedSegments).toEqual(["seg-seg-1.jsonl"]);
        expect(listSpoolSegments(paths).map((s) => s.name)).toEqual(["seg-seg-2.jsonl"]);
    });
});
