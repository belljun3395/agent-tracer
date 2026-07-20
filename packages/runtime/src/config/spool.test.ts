import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {ensureSpoolDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {
    appendSpoolLines,
    enforceSpoolSizeCap,
    listSpoolSegments,
    readSpoolSegment,
    splitOversizedSegments,
    SPOOL_BATCH_MAX,
} from "~runtime/config/spool.js";

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

describe("배치 상한 분할", () => {
    it("상한 이하는 세그먼트 하나로 쓴다", () => {
        appendSpoolLines(lines(SPOOL_BATCH_MAX), paths, "seg-1");

        expect(listSpoolSegments(paths).map((s) => s.name)).toEqual(["seg-seg-1.jsonl"]);
    });

    it("상한을 넘기면 상한 이하 조각으로 나눠 쓴다", () => {
        appendSpoolLines(lines(SPOOL_BATCH_MAX * 2 + 1), paths, "seg-1");

        const segments = listSpoolSegments(paths);
        expect(segments.map((s) => s.name)).toEqual([
            "seg-seg-1-000.jsonl",
            "seg-seg-1-001.jsonl",
            "seg-seg-1-002.jsonl",
        ]);
        expect(readSpoolSegment(segments[2]!.path)).toHaveLength(1);
    });

    it("나눠 쓴 조각은 이름 순서가 곧 원래 순서다", () => {
        appendSpoolLines(lines(SPOOL_BATCH_MAX + 1), paths, "seg-1");

        const restored = listSpoolSegments(paths).flatMap((s) => readSpoolSegment(s.path));

        expect(restored).toEqual(lines(SPOOL_BATCH_MAX + 1));
    });

    it("상한이 생기기 전에 쌓인 세그먼트를 스스로 나눈다", () => {
        writeRawSegment("seg-legacy", lines(SPOOL_BATCH_MAX + 5));

        const split = splitOversizedSegments(paths);

        expect(split).toBe(1);
        const segments = listSpoolSegments(paths);
        expect(segments.map((s) => s.name)).toEqual(["seg-seg-legacy-000.jsonl", "seg-seg-legacy-001.jsonl"]);
        expect(segments.flatMap((s) => readSpoolSegment(s.path))).toEqual(lines(SPOOL_BATCH_MAX + 5));
    });

    it("상한 이하 세그먼트는 건드리지 않는다", () => {
        appendSpoolLines(lines(3), paths, "seg-1");

        expect(splitOversizedSegments(paths)).toBe(0);
        expect(listSpoolSegments(paths).map((s) => s.name)).toEqual(["seg-seg-1.jsonl"]);
    });
});

function lines(count: number): string[] {
    return Array.from({length: count}, (_, index) => JSON.stringify({id: `e${index}`}));
}

function writeRawSegment(segmentId: string, content: readonly string[]): void {
    fs.writeFileSync(
        path.join(paths.spoolDir, `seg-${segmentId}.jsonl`),
        content.map((line) => `${line}\n`).join(""),
    );
}

describe("거절 배치 재적재", () => {
    it("절반으로 나눠 다시 넣어도 원래 순서를 지킨다", () => {
        const original = lines(10);
        appendSpoolLines(original, paths, "01AAAA");
        const base = "01AAAA";

        // 전송기가 거절당한 배치를 절반씩 되돌리는 것과 같은 순서로 쓴다.
        fs.rmSync(path.join(paths.spoolDir, `seg-${base}.jsonl`));
        appendSpoolLines(original.slice(0, 5), paths, `${base}-a`);
        appendSpoolLines(original.slice(5), paths, `${base}-b`);

        const restored = listSpoolSegments(paths).flatMap((s) => readSpoolSegment(s.path));
        expect(restored).toEqual(original);
    });

    it("되돌린 절반이 뒤에 쌓인 세그먼트보다 먼저 배달된다", () => {
        appendSpoolLines(lines(2), paths, "01BBBB");
        appendSpoolLines(["later"], paths, "01CCCC");

        fs.rmSync(path.join(paths.spoolDir, "seg-01BBBB.jsonl"));
        appendSpoolLines(lines(2).slice(0, 1), paths, "01BBBB-a");
        appendSpoolLines(lines(2).slice(1), paths, "01BBBB-b");

        expect(listSpoolSegments(paths).map((s) => s.name)).toEqual([
            "seg-01BBBB-a.jsonl",
            "seg-01BBBB-b.jsonl",
            "seg-01CCCC.jsonl",
        ]);
    });
});
