import { describe, it, expect } from "vitest";
import { EventIngestionService, type IngestEventInput } from "./event-ingestion-service.js";
import type { MonitorService } from "../monitor-service.js";
import type { TimelineLane } from "@monitor/domain";

interface Call {
    readonly method: string;
    readonly lane: TimelineLane | undefined;
}

function makeMonitorStub(): { monitor: MonitorService; calls: Call[] } {
    const calls: Call[] = [];
    const envelope = { events: [{ id: "evt_1" as unknown as never, kind: "tool.used" }] };
    const recorder = (method: string) => async (input: { lane?: TimelineLane }) => {
        calls.push({ method, lane: input.lane });
        return envelope as never;
    };
    const stub = {
        logToolUsed: recorder("logToolUsed"),
        logExploration: recorder("logExploration"),
        logTerminalCommand: recorder("logTerminalCommand"),
        logPlan: recorder("logPlan"),
        logAction: recorder("logAction"),
        logVerification: recorder("logVerification"),
        logRule: recorder("logRule"),
        logAgentActivity: recorder("logAgentActivity"),
        logUserMessage: recorder("logUserMessage"),
        logQuestion: recorder("logQuestion"),
        logTodo: recorder("logTodo"),
        logThought: recorder("logThought"),
        logAssistantResponse: recorder("logAssistantResponse"),
        saveContext: recorder("saveContext"),
        logInstructionsLoaded: recorder("logInstructionsLoaded"),
        logSessionEnded: recorder("logSessionEnded"),
        logAsyncLifecycle: recorder("logAsyncLifecycle"),
    } as unknown as MonitorService;
    return { monitor: stub, calls };
}

const baseToolEvent: IngestEventInput = {
    kind: "tool.used",
    taskId: "task_1",
    toolName: "Read",
    title: "Read",
};

describe("EventIngestionService classification", () => {
    it("routes a raw tool.used Read/Glob/Grep payload into logExploration via inferred lane", async () => {
        const { monitor, calls } = makeMonitorStub();
        const svc = new EventIngestionService(monitor);

        await svc.ingest([{ ...baseToolEvent, toolName: "Read" }]);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.method).toBe("logExploration");
        expect(calls[0]?.lane).toBe("exploration");
    });

    it("preserves explicit lane when caller supplies one", async () => {
        const { monitor, calls } = makeMonitorStub();
        const svc = new EventIngestionService(monitor);

        await svc.ingest([{ ...baseToolEvent, toolName: "Read", lane: "implementation" }]);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.method).toBe("logToolUsed");
        expect(calls[0]?.lane).toBe("implementation");
    });

    it("resolves lane for other event kinds even when caller omits it", async () => {
        const { monitor, calls } = makeMonitorStub();
        const svc = new EventIngestionService(monitor);

        await svc.ingest([{ kind: "terminal.command", taskId: "task_1", command: "ls" }]);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.method).toBe("logTerminalCommand");
        expect(calls[0]?.lane).toBeDefined();
    });
});
