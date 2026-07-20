import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo, logWarn } from "./log.js";

function captureStdout(): { lines: string[]; restore: () => void } {
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
        lines.push(String(chunk));
        return true;
    });
    return { lines, restore: () => spy.mockRestore() };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("구조화 로그", () => {
    it("한 줄에 하나의 JSON 객체를 낸다", () => {
        const { lines } = captureStdout();

        logInfo({ msg: "ingest.appended", count: 3 });

        expect(lines).toHaveLength(1);
        expect(lines[0]?.endsWith("\n")).toBe(true);
        expect(JSON.parse(lines[0]!)).toMatchObject({ level: "info", msg: "ingest.appended", count: 3 });
    });

    // Alloy는 level 값이 여덟 심각도 중 하나로 정확히 일치할 때만 detected_level 라벨을 만든다.
    it("Alloy가 아는 심각도 이름만 쓴다", () => {
        const { lines } = captureStdout();
        const errors: string[] = [];
        vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
            errors.push(String(chunk));
            return true;
        });

        logInfo({ msg: "a" });
        logWarn({ msg: "b" });
        logError({ msg: "c" });

        const levels = [...lines, ...errors].map((line) => (JSON.parse(line) as { level: string }).level);
        expect(levels).toEqual(["info", "warn", "error"]);
    });

    it("타임스탬프를 ISO 8601로 싣는다", () => {
        const { lines } = captureStdout();

        logInfo({ msg: "x" });

        expect(JSON.parse(lines[0]!).ts).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    });

    it("활성 스팬이 없으면 추적 식별자를 싣지 않는다", () => {
        const { lines } = captureStdout();

        logInfo({ msg: "x" });

        expect(JSON.parse(lines[0]!)).not.toHaveProperty("trace_id");
    });
});
