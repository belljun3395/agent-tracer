import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TaskLifecycleService } from "./task.lifecycle.service.js";
import type { TaskQueryService } from "./task.query.service.js";
import type { TaskManagementService } from "./task.management.service.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { IIdGenerator } from "../application/outbound/id.generator.port.js";
import type {
    ISessionAccess,
    SessionAccessRecord,
} from "../application/outbound/session.access.port.js";
import type {
    ITimelineEventAccess,
    TimelineEventInsertInput,
    TimelineEventRecord,
} from "../application/outbound/timeline.event.access.port.js";
import type {
    IEventProjectionAccess,
    ProjectedTimelineEvent,
} from "../application/outbound/event.projection.access.port.js";
import type {
    ITaskNotificationPublisher,
    TaskOutboundNotification,
} from "../application/outbound/notification.publisher.port.js";
import type { MonitoringTask } from "../domain/task.model.js";
import { TaskNotFoundError } from "../common/task.errors.js";

const FROZEN_ISO = "2026-04-29T10:00:00.000Z";
const LATER_ISO = "2026-04-29T11:00:00.000Z";

function makeClock(iso = FROZEN_ISO): IClock & { nowIso: Mock; nowMs: Mock } {
    return {
        nowMs: vi.fn(() => Date.parse(iso)),
        nowIso: vi.fn(() => iso),
    };
}

function makeIdGen(sequence: readonly string[]): IIdGenerator & { newUuid: Mock; newUlid: Mock } {
    let i = 0;
    return {
        newUuid: vi.fn(() => {
            const value = sequence[i] ?? `unexpected-${i}`;
            i += 1;
            return value;
        }),
        newUlid: vi.fn((timeMs?: number) => `ulid-${timeMs ?? "now"}`),
    };
}

function makeSessionAccess(): ISessionAccess & {
    create: Mock; findById: Mock; findActiveByTaskId: Mock; updateStatus: Mock;
} {
    return {
        create: vi.fn(async (req): Promise<SessionAccessRecord> => ({
            id: req.id,
            taskId: req.taskId,
            status: req.status,
            startedAt: req.startedAt,
            ...(req.summary ? { summary: req.summary } : {}),
        })),
        findById: vi.fn(async () => null),
        findActiveByTaskId: vi.fn(async () => null),
        updateStatus: vi.fn(async () => undefined),
    };
}

function makeTimelineEvents(): ITimelineEventAccess & { insert: Mock; findByTaskId: Mock; findById: Mock; countAll: Mock } {
    return {
        insert: vi.fn(async (input: TimelineEventInsertInput): Promise<TimelineEventRecord> => ({
            id: input.id,
            taskId: input.taskId,
            kind: input.kind,
            lane: input.lane,
            createdAt: input.createdAt,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            ...(input.title ? { title: input.title } : {}),
            ...(input.body ? { body: input.body } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
        })),
        findByTaskId: vi.fn(async () => []),
        findById: vi.fn(async () => null),
        countAll: vi.fn(async () => 0),
    };
}

function makeProjection(): IEventProjectionAccess & { project: Mock } {
    return {
        project: vi.fn((e): ProjectedTimelineEvent => ({
            id: e.id,
            taskId: e.taskId,
            kind: e.kind,
            lane: e.lane,
            title: e.title,
            metadata: e.metadata,
            classification: e.classification,
            createdAt: e.createdAt,
            paths: { filePaths: [], mentionedPaths: [] },
            ...(e.sessionId ? { sessionId: e.sessionId } : {}),
            ...(e.body ? { body: e.body } : {}),
        })),
    };
}

function makeNotifier(): ITaskNotificationPublisher & { publish: Mock; calls: TaskOutboundNotification[] } {
    const calls: TaskOutboundNotification[] = [];
    const publish = vi.fn((n: TaskOutboundNotification) => { calls.push(n); });
    return { publish, calls };
}

interface Harness {
    service: TaskLifecycleService;
    query: TaskQueryService & { findById: Mock };
    management: TaskManagementService & { upsertFromDraft: Mock; updateStatus: Mock };
    sessions: ReturnType<typeof makeSessionAccess>;
    events: ReturnType<typeof makeTimelineEvents>;
    projection: ReturnType<typeof makeProjection>;
    notifier: ReturnType<typeof makeNotifier>;
    clock: ReturnType<typeof makeClock>;
    idGen: ReturnType<typeof makeIdGen>;
}

function setup(opts: {
    findByIdReturns?: MonitoringTask | null;
    upsertReturns?: MonitoringTask;
    updateStatusReturns?: MonitoringTask | null;
    clockSequence?: readonly string[];
    idSequence?: readonly string[];
} = {}): Harness {
    const query = {
        findById: vi.fn(async () => opts.findByIdReturns ?? null),
    } as unknown as TaskQueryService & { findById: Mock };

    const management = {
        upsertFromDraft: vi.fn(async () => opts.upsertReturns ?? defaultTask("t-1")),
        updateStatus: vi.fn(async () => opts.updateStatusReturns ?? null),
    } as unknown as TaskManagementService & { upsertFromDraft: Mock; updateStatus: Mock };

    const sessions = makeSessionAccess();
    const events = makeTimelineEvents();
    const projection = makeProjection();
    const notifier = makeNotifier();
    const clockSeq = opts.clockSequence;
    const clock = clockSeq && clockSeq.length > 0
        ? (() => {
            let i = 0;
            return {
                nowMs: vi.fn(() => Date.parse(clockSeq[i] ?? clockSeq.at(-1)!)),
                nowIso: vi.fn(() => {
                    const v = clockSeq[i] ?? clockSeq.at(-1)!;
                    i += 1;
                    return v;
                }),
            };
        })()
        : makeClock();
    const idGen = makeIdGen(opts.idSequence ?? ["id-task", "id-session", "id-event"]);

    const service = new TaskLifecycleService(
        query,
        management,
        sessions,
        events,
        projection,
        notifier,
        clock,
        idGen,
    );
    return { service, query, management, sessions, events, projection, notifier, clock, idGen };
}

function defaultTask(id: string, overrides: Partial<MonitoringTask> = {}): MonitoringTask {
    return {
        id,
        title: "Task " + id,
        slug: "task-" + id,
        status: "running",
        taskKind: "primary",
        createdAt: FROZEN_ISO,
        updatedAt: FROZEN_ISO,
        ...overrides,
    };
}

describe("TaskLifecycleService.startTask", () => {
    describe("when task does not exist yet", () => {
        let h: Harness;

        beforeEach(() => {
            h = setup({
                findByIdReturns: null,
                upsertReturns: defaultTask("id-task", { title: "New task" }),
                idSequence: ["id-task", "id-session", "id-event"],
            });
        });

        it("uses IIdGenerator for taskId, sessionId, and event id (no globalThis.crypto)", async () => {
            const result = await h.service.startTask({ title: "New task" });

            expect(h.idGen.newUuid).toHaveBeenCalledTimes(3);
            expect(result.task.id).toBe("id-task");
            expect(result.sessionId).toBe("id-session");
            expect(result.events).toEqual([
                { id: "id-event", kind: "task.start" },
            ]);
        });

        it("uses IClock.nowIso() for startedAt (no new Date)", async () => {
            await h.service.startTask({ title: "New task" });

            expect(h.clock.nowIso).toHaveBeenCalled();
            const draftArg = h.management.upsertFromDraft.mock.calls[0]![0];
            expect(draftArg.updatedAt).toBe(FROZEN_ISO);
            expect(draftArg.lastSessionStartedAt).toBe(FROZEN_ISO);
        });

        it("creates a session via the SessionAccess port with the generated id", async () => {
            await h.service.startTask({ title: "New task" });

            expect(h.sessions.create).toHaveBeenCalledTimes(1);
            const sessionArg = h.sessions.create.mock.calls[0]![0];
            expect(sessionArg.id).toBe("id-session");
            expect(sessionArg.taskId).toBe("id-task");
            expect(sessionArg.status).toBe("running");
            expect(sessionArg.startedAt).toBe(FROZEN_ISO);
        });

        it("publishes task.started + session.started + event.logged notifications", async () => {
            await h.service.startTask({ title: "New task" });

            const types = h.notifier.calls.map((c) => c.type);
            expect(types).toEqual(["task.started", "session.started", "event.logged"]);
        });

        it("inserts a single timeline event with kind='task.start' and the generated id", async () => {
            await h.service.startTask({ title: "New task" });

            expect(h.events.insert).toHaveBeenCalledTimes(1);
            const eventArg = h.events.insert.mock.calls[0]![0];
            expect(eventArg.id).toBe("id-event");
            expect(eventArg.kind).toBe("task.start");
            expect(eventArg.createdAt).toBe(FROZEN_ISO);
        });

        it("respects an explicit input.taskId instead of generating a new one", async () => {
            const harness = setup({
                findByIdReturns: null,
                upsertReturns: defaultTask("explicit-task"),
                idSequence: ["should-be-ignored", "id-session", "id-event"],
            });

            const result = await harness.service.startTask({
                taskId: "explicit-task",
                title: "x",
            });

            expect(result.task.id).toBe("explicit-task");
            // sessionId still uses idGen
            expect(harness.idGen.newUuid).toHaveBeenCalled();
        });
    });

    describe("when task already exists", () => {
        const existing = defaultTask("t-existing", { status: "completed", runtimeSource: "old" });

        it("does not insert a timeline event and returns no events", async () => {
            const h = setup({
                findByIdReturns: existing,
                upsertReturns: { ...existing, status: "running" },
            });

            const result = await h.service.startTask({ taskId: "t-existing", title: "x" });

            expect(h.events.insert).not.toHaveBeenCalled();
            expect(result.events).toEqual([]);
        });

        it("publishes task.updated when status differs from existing", async () => {
            const h = setup({
                findByIdReturns: existing,
                upsertReturns: { ...existing, status: "running" },
            });

            await h.service.startTask({ taskId: "t-existing", title: "x" });

            const types = h.notifier.calls.map((c) => c.type);
            expect(types).toContain("task.updated");
            expect(types).toContain("task.started");
            expect(types).toContain("session.started");
        });

        it("publishes task.updated when runtimeSource changes", async () => {
            const h = setup({
                findByIdReturns: { ...existing, status: "running", runtimeSource: "old" },
                upsertReturns: { ...existing, status: "running", runtimeSource: "new" },
            });

            await h.service.startTask({ taskId: "t-existing", title: "x", runtimeSource: "new" });

            expect(h.notifier.calls.map((c) => c.type)).toContain("task.updated");
        });

        it("does NOT publish task.updated when status and runtimeSource are unchanged", async () => {
            const stable = { ...existing, status: "running" as const, runtimeSource: "stable" };
            const h = setup({
                findByIdReturns: stable,
                upsertReturns: stable,
            });

            await h.service.startTask({ taskId: "t-existing", title: "x", runtimeSource: "stable" });

            expect(h.notifier.calls.map((c) => c.type)).not.toContain("task.updated");
        });
    });
});

describe("TaskLifecycleService.finalizeTask", () => {
    it("throws TaskNotFoundError when the task does not exist", async () => {
        const h = setup({ findByIdReturns: null });

        await expect(
            h.service.finalizeTask({ taskId: "missing", outcome: "completed" }),
        ).rejects.toBeInstanceOf(TaskNotFoundError);
    });

    it("uses IClock for endedAt and IIdGenerator for the event id", async () => {
        const initialTask = defaultTask("t-1");
        const completedTask = { ...initialTask, status: "completed" as const };
        const h = setup({
            idSequence: ["id-event"],
            clockSequence: [LATER_ISO],
        });
        h.query.findById
            .mockResolvedValueOnce(initialTask)
            .mockResolvedValueOnce(completedTask);
        h.sessions.findActiveByTaskId.mockResolvedValueOnce({
            id: "active-session",
            taskId: "t-1",
            status: "running",
            startedAt: FROZEN_ISO,
        });
        h.sessions.findById.mockResolvedValueOnce({
            id: "active-session",
            taskId: "t-1",
            status: "running",
            startedAt: FROZEN_ISO,
        });

        await h.service.finalizeTask({ taskId: "t-1", outcome: "completed", summary: "done" });

        expect(h.management.updateStatus).toHaveBeenCalledWith("t-1", "completed", LATER_ISO);
        expect(h.events.insert).toHaveBeenCalledTimes(1);
        const eventArg = h.events.insert.mock.calls[0]![0];
        expect(eventArg.id).toBe("id-event");
        expect(eventArg.kind).toBe("task.complete");
        expect(eventArg.createdAt).toBe(LATER_ISO);
    });

    it("publishes task.completed when outcome is completed", async () => {
        const initialTask = defaultTask("t-1");
        const finalTask = { ...initialTask, status: "completed" as const };
        const h = setup({});
        h.query.findById
            .mockResolvedValueOnce(initialTask)
            .mockResolvedValueOnce(finalTask);

        await h.service.finalizeTask({ taskId: "t-1", outcome: "completed" });

        const types = h.notifier.calls.map((c) => c.type);
        expect(types).toContain("task.completed");
    });

    it("publishes task.updated (not task.completed) when outcome is errored", async () => {
        const initialTask = defaultTask("t-1");
        const finalTask = { ...initialTask, status: "errored" as const };
        const h = setup({});
        h.query.findById
            .mockResolvedValueOnce(initialTask)
            .mockResolvedValueOnce(finalTask);

        await h.service.finalizeTask({
            taskId: "t-1",
            outcome: "errored",
            errorMessage: "boom",
        });

        const types = h.notifier.calls.map((c) => c.type);
        expect(types).toContain("task.updated");
        expect(types).not.toContain("task.completed");
    });

    it("is a no-op (no event, no status update) when the task already has the target status", async () => {
        const completed = defaultTask("t-1", { status: "completed" });
        const h = setup({});
        h.query.findById.mockResolvedValueOnce(completed);

        const result = await h.service.finalizeTask({ taskId: "t-1", outcome: "completed" });

        expect(h.management.updateStatus).not.toHaveBeenCalled();
        expect(h.events.insert).not.toHaveBeenCalled();
        expect(result.events).toEqual([]);
    });

    it("uses errored event body=errorMessage, completed event body=summary", async () => {
        const t1 = defaultTask("t-1");
        const erroredFinal = { ...t1, status: "errored" as const };
        const h = setup({});
        h.query.findById
            .mockResolvedValueOnce(t1)
            .mockResolvedValueOnce(erroredFinal);

        await h.service.finalizeTask({
            taskId: "t-1",
            outcome: "errored",
            summary: "ignored",
            errorMessage: "real",
        });

        const eventArg = h.events.insert.mock.calls[0]![0];
        expect(eventArg.body).toBe("real");
    });
});
