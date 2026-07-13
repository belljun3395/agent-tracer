import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {
    compactFinishedEvent,
    compactStartedEvent,
    configChangedEvent,
    contextSnapshotEvent,
    cwdChangedEvent,
    notificationEvent,
    sessionTriggerEvent,
    setupEvent,
    toolBatchEvent,
} from "~runtime/domain/ingest/model/lifecycle.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};

describe("세션 계기 이벤트", () => {
    it("아는 계기를 컨텍스트 이벤트로 만든다", () => {
        const event = sessionTriggerEvent(TARGET, "resume");

        expect(event?.kind).toBe(KIND.contextSaved);
        expect(event?.title).toBe("Session resumed");
        expect(event?.turnId).toBe("turn-1");
        expect((event?.metadata as Record<string, unknown>)["trigger"]).toBe("resume");
    });

    it("모르는 계기는 기록하지 않는다", () => {
        expect(sessionTriggerEvent(TARGET, "unknown")).toBeNull();
    });
});

describe("컨텍스트 변경 이벤트", () => {
    it("설정 변경 출처를 제목과 계기에 담는다", () => {
        const event = configChangedEvent(TARGET, "settings.json");

        expect(event.title).toBe("Config changed: settings.json");
        expect((event.metadata as Record<string, unknown>)["trigger"]).toBe("config_change:settings.json");
    });

    it("작업 디렉터리 변경은 이전 경로가 있으면 화살표로 잇는다", () => {
        expect(cwdChangedEvent(TARGET, "/a", "/b").body).toBe("/a → /b");
        expect(cwdChangedEvent(TARGET, undefined, "/b").body).toBe("cwd set to /b");
        expect(cwdChangedEvent(TARGET, undefined, undefined).body).toBe("cwd changed");
    });

    it("알림 메시지가 없으면 본문을 비운다", () => {
        expect(notificationEvent(TARGET, "idle_prompt", undefined).body).toBeUndefined();
    });

    it("병렬 배치는 도구 수와 이름을 담는다", () => {
        const event = toolBatchEvent(TARGET, ["Read", "Grep"]);

        expect(event.title).toBe("Parallel tool batch (2)");
        expect(event.body).toBe("Tools: Read, Grep");
        expect((event.metadata as Record<string, unknown>)["itemCount"]).toBe(2);
    });

    it("압축 전후를 compactPhase로 구분한다", () => {
        const before = compactStartedEvent(TARGET, "manual", "지시");
        const after = compactFinishedEvent(TARGET, "auto", undefined);

        expect((before.metadata as Record<string, unknown>)["compactPhase"]).toBe("before");
        expect(before.body).toBe("지시");
        expect((after.metadata as Record<string, unknown>)["compactPhase"]).toBe("after");
        expect(after.body).toBe("Claude Code compacted the conversation history.");
    });
});

describe("셋업과 스냅샷 이벤트", () => {
    it("유지보수 셋업과 초기화 셋업의 제목을 나눈다", () => {
        expect(setupEvent(TARGET, "maintenance").title).toBe("Setup: maintenance");
        expect(setupEvent(TARGET, "init").title).toBe("Setup: init");
    });

    it("컨텍스트 사용률이 있으면 제목에 반올림해 담는다", () => {
        const event = contextSnapshotEvent(TARGET, {contextWindowUsedPct: 42.4, costTotalUsd: 1.5});

        expect(event.kind).toBe(KIND.contextSnapshot);
        expect(event.title).toBe("Context 42% used");
        expect((event.metadata as Record<string, unknown>)["costTotalUsd"]).toBe(1.5);
    });

    it("컨텍스트 사용률이 없으면 일반 제목을 쓴다", () => {
        expect(contextSnapshotEvent(TARGET, {}).title).toBe("Context snapshot");
    });
});
