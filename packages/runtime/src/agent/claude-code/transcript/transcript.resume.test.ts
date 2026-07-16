import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {findResumedSessionId} from "~runtime/agent/claude-code/transcript/transcript.resume.js";

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "transcript-resume-test-"));
});

afterEach(() => {
    fs.rmSync(tmp, {recursive: true, force: true});
});

function writeTranscript(lines: readonly (Record<string, unknown> | string)[]): string {
    const filePath = path.join(tmp, "transcript.jsonl");
    const content = lines
        .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
        .join("\n");
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
}

describe("findResumedSessionId", () => {
    it("재개본에서는 현재 세션과 다른 session_id 중 마지막 값을 직전 세션으로 본다", async () => {
        const filePath = writeTranscript([
            {type: "user", session_id: "old-session-1"},
            {type: "assistant", session_id: "old-session-1"},
            {type: "user", session_id: "new-session"},
            {type: "assistant", session_id: "new-session"},
        ]);

        await expect(findResumedSessionId(filePath, "new-session")).resolves.toBe("old-session-1");
    });

    it("신선본에서는 모든 줄의 session_id가 같으므로 undefined다", async () => {
        const filePath = writeTranscript([
            {type: "user", session_id: "new-session"},
            {type: "assistant", session_id: "new-session"},
        ]);

        await expect(findResumedSessionId(filePath, "new-session")).resolves.toBeUndefined();
    });

    it("session_id가 없는 라인이 섞여도 직전 세션을 찾아낸다", async () => {
        const filePath = writeTranscript([
            {type: "user", session_id: "old-session-1"},
            {type: "ai-title", title: "요약 제목"},
            {type: "mode"},
            {type: "user", session_id: "new-session"},
        ]);

        await expect(findResumedSessionId(filePath, "new-session")).resolves.toBe("old-session-1");
    });

    it("빈 파일은 undefined다", async () => {
        const filePath = writeTranscript([]);

        await expect(findResumedSessionId(filePath, "new-session")).resolves.toBeUndefined();
    });

    it("여러 번 재개됐으면 파일 순서상 마지막으로 등장한 직전 세션만 남는다", async () => {
        const filePath = writeTranscript([
            {type: "user", session_id: "oldest-session"},
            {type: "user", session_id: "middle-session"},
            {type: "user", session_id: "new-session"},
        ]);

        await expect(findResumedSessionId(filePath, "new-session")).resolves.toBe("middle-session");
    });

    it("줄 상한을 넘는 뒤쪽의 다른 session_id는 보지 않는다", async () => {
        const lines: Record<string, unknown>[] = [];
        for (let index = 0; index < 5; index += 1) {
            lines.push({type: "user", session_id: "new-session"});
        }
        lines.push({type: "user", session_id: "late-session"});
        const filePath = writeTranscript(lines);

        await expect(findResumedSessionId(filePath, "new-session", 5)).resolves.toBeUndefined();
    });

    it("존재하지 않는 파일은 undefined다", async () => {
        await expect(
            findResumedSessionId(path.join(tmp, "missing.jsonl"), "new-session"),
        ).resolves.toBeUndefined();
    });
});
