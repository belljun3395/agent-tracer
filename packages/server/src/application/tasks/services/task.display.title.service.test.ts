import { describe, expect, it } from "vitest";
import type { MonitoringTask, TimelineEvent } from "~domain/index.js";
import { deriveTaskDisplayTitle } from "./task.display.title.service.js";

function makeTask(overrides: Partial<MonitoringTask> = {}): MonitoringTask {
    return {
        id: "task-1",
        title: "Codex CLI — agent-tracer",
        slug: "codex-cli-agent-tracer",
        status: "running",
        workspacePath: "/workspace/agent-tracer",
        createdAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:00.000Z",
        ...overrides,
    };
}

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
    return {
        id: "event-1",
        taskId: "task-1",
        kind: "user.message",
        lane: "user",
        title: "User prompt",
        body: "Claude 쪽 title 동작을 보고 Codex title을 개선할 수 있는지 검토해줘",
        metadata: {},
        classification: {
            lane: "user",
            tags: [],
            matches: [],
        },
        createdAt: "2026-04-21T00:00:00.000Z",
        ...overrides,
    };
}

describe("deriveTaskDisplayTitle", () => {
    it("uses the first user prompt when Codex CLI only provided a workspace title", () => {
        expect(deriveTaskDisplayTitle(makeTask(), [makeEvent()]))
            .toBe("Claude 쪽 title 동작을 보고 Codex title을 개선할 수 있는지 검토해줘");
    });

    it("uses the first user prompt when Codex app-server only provided a workspace title", () => {
        expect(deriveTaskDisplayTitle(makeTask({
            title: "Codex app-server — agent-tracer",
            slug: "codex-app-server-agent-tracer",
        }), [makeEvent()]))
            .toBe("Claude 쪽 title 동작을 보고 Codex title을 개선할 수 있는지 검토해줘");
    });
});
