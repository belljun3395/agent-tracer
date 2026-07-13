import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {KIND} from "@monitor/kernel";
import {afterEach, describe, expect, it} from "vitest";
import {
    captureTranscriptCommentary,
    tailTranscriptCommentary,
} from "~runtime/agent/claude-code/transcript/transcript.commentary.js";
import {resolveTranscriptCursorDir} from "~runtime/agent/claude-code/transcript/transcript.cursor.js";
import {transcriptCommentaryId} from "~runtime/agent/claude-code/transcript/transcript.event.js";
import {TRANSCRIPT_READ_MAX_BYTES} from "~runtime/agent/claude-code/transcript/transcript.reader.js";
import type {RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1"};
const tempDirs: string[] = [];

function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tracer-transcript-"));
    tempDirs.push(dir);
    return dir;
}

function assistantEntry(
    uuid: string,
    stopReason: string,
    content: readonly Record<string, unknown>[],
): Record<string, unknown> {
    return {
        type: "assistant",
        uuid,
        parentUuid: `parent-${uuid}`,
        requestId: `request-${uuid}`,
        message: {role: "assistant", stop_reason: stopReason, content},
    };
}

function userPromptEntry(uuid: string, content: string): Record<string, unknown> {
    return {type: "user", uuid, message: {role: "user", content}};
}

function writeJsonl(filePath: string, entries: readonly unknown[]): void {
    fs.writeFileSync(filePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

describe("트랜스크립트 중간 발화 수집", () => {
    it("기본 커서를 프로젝트 밖 캐시 디렉터리에 둔다", () => {
        const home = makeTempDir();

        expect(resolveTranscriptCursorDir({HOME: home})).toBe(
            path.join(home, ".agent-tracer", "cache", "claude-transcript-cursors"),
        );
    });

    it("도구 호출과 분리된 text 블록만 중간 발화로 만든다", () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "session.jsonl");
        writeJsonl(transcriptPath, [
            assistantEntry("text-1", "tool_use", [{type: "text", text: "먼저 설정을 확인한다."}]),
            assistantEntry("tool-1", "tool_use", [{type: "tool_use", name: "Read"}]),
            assistantEntry("final-1", "end_turn", [{type: "text", text: "완료했다."}]),
            assistantEntry("text-2", "tool_use", [
                {type: "text", text: "첫 문장"},
                {type: "thinking", thinking: "비공개 추론"},
                {type: "text", text: "둘째 문장"},
            ]),
        ]);

        const tail = tailTranscriptCommentary(
            "claude-session",
            transcriptPath,
            TARGET,
            path.join(dir, "cursors"),
        );

        expect(tail?.events.map((event) => event.body)).toEqual([
            "먼저 설정을 확인한다.",
            "첫 문장",
            "둘째 문장",
        ]);
        expect(tail?.events.every((event) => event.kind === KIND.assistantCommentary)).toBe(true);
        expect(tail?.events.map((event) => event.metadata)).toEqual([
            expect.objectContaining({phase: "commentary", assistantUuid: "text-1", contentIndex: 0}),
            expect.objectContaining({phase: "commentary", assistantUuid: "text-2", contentIndex: 0}),
            expect.objectContaining({phase: "commentary", assistantUuid: "text-2", contentIndex: 2}),
        ]);
    });

    it("세션과 엔트리와 위치가 같으면 다시 읽어도 같은 ID를 만든다", () => {
        const first = transcriptCommentaryId("session-1", "entry-1", 0);

        expect(transcriptCommentaryId("session-1", "entry-1", 0)).toBe(first);
        expect(transcriptCommentaryId("session-2", "entry-1", 0)).not.toBe(first);
        expect(transcriptCommentaryId("session-1", "entry-1", 1)).not.toBe(first);
        expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("첫 수집에서는 마지막 사용자 프롬프트 이후 발화만 모은다", () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "existing.jsonl");
        writeJsonl(transcriptPath, [
            userPromptEntry("old-prompt", "이전 요청"),
            assistantEntry("old-commentary", "tool_use", [{type: "text", text: "이전 턴 발화"}]),
            userPromptEntry("current-prompt", "현재 요청"),
            assistantEntry("current-commentary", "tool_use", [{type: "text", text: "현재 턴 발화"}]),
        ]);

        const tail = tailTranscriptCommentary(
            "existing-session",
            transcriptPath,
            TARGET,
            path.join(dir, "cursors"),
        );

        expect(tail?.events.map((event) => event.body)).toEqual(["현재 턴 발화"]);
    });

    it("완성되지 않은 마지막 줄은 다음 훅에서 이어 읽는다", async () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "session.jsonl");
        const cursorDir = path.join(dir, "cursors");
        const first = JSON.stringify(assistantEntry("text-1", "tool_use", [{type: "text", text: "첫 발화"}]));
        const second = JSON.stringify(assistantEntry("text-2", "tool_use", [{type: "text", text: "둘째 발화"}]));
        const splitAt = Math.floor(second.length / 2);
        fs.writeFileSync(transcriptPath, `${first}\n${second.slice(0, splitAt)}`);
        const posted: RuntimeIngestEvent[] = [];
        const postEvents = async (events: readonly RuntimeIngestEvent[]): Promise<void> => {
            posted.push(...events);
        };

        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);
        expect(posted.map((event) => event.body)).toEqual(["첫 발화"]);

        fs.appendFileSync(transcriptPath, `${second.slice(splitAt)}\n`);
        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);
        expect(posted.map((event) => event.body)).toEqual(["첫 발화", "둘째 발화"]);
    });

    it("전송에 실패하면 커서를 확정하지 않고 다음 훅에서 다시 모은다", async () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "session.jsonl");
        const cursorDir = path.join(dir, "cursors");
        writeJsonl(transcriptPath, [
            assistantEntry("text-1", "tool_use", [{type: "text", text: "재시도할 발화"}]),
        ]);

        await expect(captureTranscriptCommentary(
            {sessionId: "session-1", transcriptPath},
            TARGET,
            () => Promise.reject(new Error("spool unavailable")),
            cursorDir,
        )).resolves.toBeUndefined();

        const posted: RuntimeIngestEvent[] = [];
        const postEvents = async (events: readonly RuntimeIngestEvent[]): Promise<void> => {
            posted.push(...events);
        };
        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);
        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);

        expect(posted).toHaveLength(1);
        expect(posted[0]?.body).toBe("재시도할 발화");
    });

    it("서브에이전트는 자기 트랜스크립트와 가상 세션 ID를 쓴다", async () => {
        const dir = makeTempDir();
        const parentPath = path.join(dir, "parent.jsonl");
        const agentPath = path.join(dir, "agent.jsonl");
        writeJsonl(parentPath, [assistantEntry("parent-text", "tool_use", [{type: "text", text: "부모 발화"}])]);
        writeJsonl(agentPath, [assistantEntry("agent-text", "tool_use", [{type: "text", text: "자식 발화"}])]);
        const posted: RuntimeIngestEvent[] = [];

        await captureTranscriptCommentary(
            {
                sessionId: "parent-session",
                agentId: "agent-1",
                transcriptPath: parentPath,
                agentTranscriptPath: agentPath,
            },
            {taskId: "child-task", sessionId: "child-session"},
            async (events) => {
                posted.push(...events);
            },
            path.join(dir, "cursors"),
        );

        expect(posted).toHaveLength(1);
        expect(posted[0]).toEqual(expect.objectContaining({
            taskId: "child-task",
            sessionId: "child-session",
            body: "자식 발화",
            metadata: expect.objectContaining({sourceId: "sub--agent-1"}),
        }));
    });

    it("같은 크기로 교체된 트랜스크립트도 head 지문으로 다시 읽는다", async () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "session.jsonl");
        const cursorDir = path.join(dir, "cursors");
        const posted: RuntimeIngestEvent[] = [];
        const postEvents = async (events: readonly RuntimeIngestEvent[]): Promise<void> => {
            posted.push(...events);
        };
        writeJsonl(transcriptPath, [assistantEntry("entry-a", "tool_use", [{type: "text", text: "AAAA"}])]);
        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);

        writeJsonl(transcriptPath, [assistantEntry("entry-b", "tool_use", [{type: "text", text: "BBBB"}])]);
        await captureTranscriptCommentary({sessionId: "session-1", transcriptPath}, TARGET, postEvents, cursorDir);

        expect(posted.map((event) => event.body)).toEqual(["AAAA", "BBBB"]);
    });

    it("큰 backlog는 최근 tail의 줄 경계부터 읽는다", () => {
        const dir = makeTempDir();
        const transcriptPath = path.join(dir, "large.jsonl");
        const filler = `${JSON.stringify({
            type: "assistant",
            uuid: "filler",
            message: {role: "assistant", stop_reason: "tool_use", content: [{type: "tool_use", input: "x".repeat(180)}]},
        })}\n`;
        const fillerCount = Math.ceil((TRANSCRIPT_READ_MAX_BYTES + 8192) / Buffer.byteLength(filler));
        const target = assistantEntry("recent-text", "tool_use", [{type: "text", text: "최근 발화"}]);
        fs.writeFileSync(transcriptPath, `${filler.repeat(fillerCount)}${JSON.stringify(target)}\n`);

        const tail = tailTranscriptCommentary(
            "large-session",
            transcriptPath,
            TARGET,
            path.join(dir, "cursors"),
        );

        expect(fs.statSync(transcriptPath).size).toBeGreaterThan(TRANSCRIPT_READ_MAX_BYTES);
        expect(tail?.events.map((event) => event.body)).toEqual(["최근 발화"]);
        expect(tail?.nextCursor.byteOffset).toBe(fs.statSync(transcriptPath).size);
    });
});
