import { vi } from "vitest";
import type { TimelineEvent } from "~domain/monitoring/index.js";
import type { MonitoringSession } from "~domain/monitoring/index.js";
import type { MonitoringTask } from "~domain/monitoring/index.js";
import type {
    IEventRepository,
    INotificationPublisher,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
    RuntimeBinding,
} from "~application/ports/index.js";
import { TaskLifecycleService } from "~application/tasks/services/task.lifecycle.service.js";

export interface TestPorts {
    readonly tasks: ITaskRepository;
    readonly sessions: ISessionRepository;
    readonly events: IEventRepository;
    readonly runtimeBindings: IRuntimeBindingRepository;
    readonly notifier: INotificationPublisher;
}

export type RuntimeBindingRow = Omit<RuntimeBinding, "monitorSessionId"> & {
    monitorSessionId: string | null;
};

export function task(input: Partial<MonitoringTask> & { id: string }): MonitoringTask {
    return {
        id: input.id,
        title: input.title ?? input.id,
        slug: input.slug ?? input.id,
        status: input.status ?? "running",
        taskKind: input.taskKind ?? "primary",
        createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
        updatedAt: input.updatedAt ?? "2026-01-01T00:00:00.000Z",
        ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
        ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
        ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
        ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}),
        ...(input.lastSessionStartedAt ? { lastSessionStartedAt: input.lastSessionStartedAt } : {}),
        ...(input.runtimeSource ? { runtimeSource: input.runtimeSource } : {}),
    };
}

export function session(input: Partial<MonitoringSession> & { id: string; taskId: string }): MonitoringSession {
    return {
        id: input.id,
        taskId: input.taskId,
        status: input.status ?? "running",
        startedAt: input.startedAt ?? "2026-01-01T00:00:00.000Z",
        ...(input.endedAt ? { endedAt: input.endedAt } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
    };
}

export function binding(input: Partial<RuntimeBindingRow> & {
    runtimeSource?: string;
    runtimeSessionId?: string;
    taskId: string;
}): RuntimeBindingRow {
    return {
        runtimeSource: input.runtimeSource ?? "codex",
        runtimeSessionId: input.runtimeSessionId ?? "runtime-1",
        taskId: input.taskId,
        monitorSessionId: input.monitorSessionId === undefined ? "session-1" : input.monitorSessionId,
        createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
        updatedAt: input.updatedAt ?? "2026-01-01T00:00:00.000Z",
    };
}

export function createPorts(seed?: {
    tasks?: readonly MonitoringTask[];
    sessions?: readonly MonitoringSession[];
    bindings?: readonly RuntimeBindingRow[];
}) {
    const tasks = new Map(seed?.tasks?.map((record) => [record.id, record]) ?? []);
    const sessions = new Map(seed?.sessions?.map((record) => [record.id, record]) ?? []);
    const bindings = new Map<string, RuntimeBindingRow>();
    const events: TimelineEvent[] = [];
    const key = (runtimeSource: string, runtimeSessionId: string) => `${runtimeSource}:${runtimeSessionId}`;
    for (const record of seed?.bindings ?? []) {
        bindings.set(key(record.runtimeSource, record.runtimeSessionId), record);
    }

    const notifier = { publish: vi.fn() };
    const sessionsCreate = vi.fn(async (input) => {
        const record = session(input);
        sessions.set(record.id, record);
        return record;
    });
    const sessionsUpdateStatus = vi.fn(async (id, status, endedAt, summary) => {
        const record = sessions.get(id);
        if (record) {
            sessions.set(id, {
                ...record,
                status,
                endedAt,
                ...(summary ? { summary } : {}),
            });
        }
    });
    const runtimeBindingsUpsert = vi.fn(async (input) => {
        const now = "2026-01-01T00:00:00.000Z";
        const record = binding({
            runtimeSource: input.runtimeSource,
            runtimeSessionId: input.runtimeSessionId,
            taskId: input.taskId,
            monitorSessionId: input.monitorSessionId,
            createdAt: bindings.get(key(input.runtimeSource, input.runtimeSessionId))?.createdAt ?? now,
            updatedAt: now,
        });
        bindings.set(key(input.runtimeSource, input.runtimeSessionId), record);
        return record as RuntimeBinding;
    });
    const runtimeBindingsClearSession = vi.fn(async (runtimeSource: string, runtimeSessionId: string) => {
        const record = bindings.get(key(runtimeSource, runtimeSessionId));
        if (record) {
            bindings.set(key(runtimeSource, runtimeSessionId), {
                ...record,
                monitorSessionId: null,
            });
        }
    });
    const ports = {
        tasks: {
            upsert: vi.fn(async (input) => {
                const record = task({
                    ...tasks.get(input.id),
                    ...input,
                    taskKind: input.taskKind,
                });
                tasks.set(record.id, record);
                return record;
            }),
            findById: vi.fn(async (id: string) => tasks.get(id) ?? null),
            findAll: vi.fn(async () => [...tasks.values()]),
            findChildren: vi.fn(async (parentId: string) =>
                [...tasks.values()].filter((record) => record.parentTaskId === parentId)),
            updateStatus: vi.fn(async (id, status, updatedAt) => {
                const record = tasks.get(id);
                if (record) tasks.set(id, { ...record, status, updatedAt });
            }),
            updateTitle: vi.fn(async (id, title, slug, updatedAt) => {
                const record = tasks.get(id);
                if (record) tasks.set(id, { ...record, title, slug, updatedAt });
            }),
            delete: vi.fn(async (id: string) => {
                tasks.delete(id);
                return { deletedIds: [id] };
            }),
            deleteFinished: vi.fn(async () => 0),
            listTaskStatuses: vi.fn(async () => [...tasks.values()].map((record) => record.status)),
            countTimelineEvents: vi.fn(async () => events.length),
        },
        sessions: {
            create: sessionsCreate,
            findById: vi.fn(async (id: string) => sessions.get(id) ?? null),
            findByTaskId: vi.fn(async (taskId: string) =>
                [...sessions.values()].filter((record) => record.taskId === taskId)),
            findActiveByTaskId: vi.fn(async (taskId: string) =>
                [...sessions.values()].find((record) =>
                    record.taskId === taskId && record.status === "running") ?? null),
            updateStatus: sessionsUpdateStatus,
            countRunningByTaskId: vi.fn(async (taskId: string) =>
                [...sessions.values()].filter((record) =>
                    record.taskId === taskId && record.status === "running").length),
        },
        events: {
            insert: vi.fn(async (input) => {
                const record = input as TimelineEvent;
                events.push(record);
                return record;
            }),
            findById: vi.fn(async (id: string) => events.find((record) => record.id === id) ?? null),
            findByTaskId: vi.fn(async (taskId: string) =>
                events.filter((record) => record.taskId === taskId)),
            updateMetadata: vi.fn(async () => null),
            search: vi.fn(async () => ({ tasks: [], events: [], bookmarks: [] })),
        },
        runtimeBindings: {
            upsert: runtimeBindingsUpsert,
            find: vi.fn(async (runtimeSource: string, runtimeSessionId: string) => {
                const record = bindings.get(key(runtimeSource, runtimeSessionId));
                if (!record?.monitorSessionId) return null;
                return record as RuntimeBinding;
            }),
            findTaskId: vi.fn(async (runtimeSource: string, runtimeSessionId: string) =>
                bindings.get(key(runtimeSource, runtimeSessionId))?.taskId ?? null),
            findLatestByTaskId: vi.fn(async () => null),
            clearSession: runtimeBindingsClearSession,
            delete: vi.fn(async (runtimeSource: string, runtimeSessionId: string) => {
                bindings.delete(key(runtimeSource, runtimeSessionId));
            }),
        },
        eventStore: {},
        bookmarks: {},
        evaluations: {},
        playbooks: {},
        ruleCommands: {},
        turnPartitions: {},
        notifier,
    } as unknown as TestPorts;

    return {
        ports,
        taskLifecycle: new TaskLifecycleService(ports.tasks, ports.sessions, ports.events, ports.notifier),
        tasks,
        sessions,
        bindings,
        events,
        notifier,
        mocks: {
            sessionsCreate,
            sessionsUpdateStatus,
            runtimeBindingsUpsert,
            runtimeBindingsClearSession,
        },
    };
}
