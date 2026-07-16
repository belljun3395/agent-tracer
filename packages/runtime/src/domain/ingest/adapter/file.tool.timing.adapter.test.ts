import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {FileToolTimingAdapter} from "~runtime/domain/ingest/adapter/file.tool.timing.adapter.js";

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tool-timing-test-"));
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

describe("FileToolTimingAdapter", () => {
    it("markStart로 남긴 시작 시각을 takeStart로 왕복한다", () => {
        const adapter = new FileToolTimingAdapter(tmp);

        adapter.markStart("session-1", "tool-use-1", 1_000);

        expect(adapter.takeStart("session-1", "tool-use-1")).toBe(1_000);
    });

    it("takeStart는 읽으면서 항목을 지운다", () => {
        const adapter = new FileToolTimingAdapter(tmp);
        adapter.markStart("session-1", "tool-use-1", 1_000);

        adapter.takeStart("session-1", "tool-use-1");

        expect(adapter.takeStart("session-1", "tool-use-1")).toBeUndefined();
    });

    it("기록이 없는 조합은 undefined를 준다", () => {
        const adapter = new FileToolTimingAdapter(tmp);

        expect(adapter.takeStart("session-1", "unknown-tool-use")).toBeUndefined();
    });

    it("세션이 다르면 서로 다른 파일에 독립적으로 쌓인다", () => {
        const adapter = new FileToolTimingAdapter(tmp);
        adapter.markStart("session-1", "tool-use-1", 1_000);
        adapter.markStart("session-2", "tool-use-1", 2_000);

        expect(adapter.takeStart("session-1", "tool-use-1")).toBe(1_000);
        expect(adapter.takeStart("session-2", "tool-use-1")).toBe(2_000);
    });

    it("6시간보다 오래된 항목은 새 markStart에서 정리된다", () => {
        const adapter = new FileToolTimingAdapter(tmp);
        const sixHoursMs = 6 * 60 * 60 * 1000;
        adapter.markStart("session-1", "stale-tool-use", 0);

        adapter.markStart("session-1", "fresh-tool-use", sixHoursMs + 1);

        expect(adapter.takeStart("session-1", "stale-tool-use")).toBeUndefined();
        expect(adapter.takeStart("session-1", "fresh-tool-use")).toBe(sixHoursMs + 1);
    });
});
