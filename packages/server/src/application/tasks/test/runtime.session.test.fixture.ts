import { vi } from "vitest";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import type { ISessionLifecycle } from "~session/public/iservice/session.lifecycle.iservice.js";
import type { SessionSnapshot } from "~session/public/dto/session.snapshot.dto.js";
import { TaskLifecycleService } from "~application/tasks/services/task.lifecycle.service.js";

export interface TestPorts {
    readonly tasks: ITaskRepository;
    readonly sessions: ISessionLifecycle;
    readonly events: IEventRepository;
    readonly notifier: INotificationPublisher;
}

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

export function session(input: Partial<SessionSnapshot> & { id: string; taskId: string }): SessionSnapshot {
    return {
        id: input.id,
        taskId: input.taskId,
        status: input.status ?? "running",
        startedAt: input.startedAt ?? "2026-01-01T00:00:00.000Z",
        ...(input.endedAt ? { endedAt: input.endedAt } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
    };
}

export function createPorts(seed?: {
    tasks?: readonly MonitoringTask[];
    sessions?: readonly SessionSnapshot[];
}) {
    const tasks = new Map(seed?.tasks?.map((record) => [record.id, record]) ?? []);
    const sessions = new Map(seed?.sessions?.map((record) => [record.id, record]) ?? []);
    const events: TimelineEvent[] = [];

    const notifier = { publish: vi.fn() };
    const sessionsCreate = vi.fn(async (input: { id: string; taskId: string; status: SessionSnapshot["status"]; startedAt: string; summary?: string }) => {
        const record = session(input);
        sessions.set(record.id, record);
        return record;
    });
    const sessionsUpdateStatus = vi.fn(async (id: string, status: SessionSnapshot["status"], endedAt: string, summary?: string) => {
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
            updateStatus: vi.fn(async (id: string, status: MonitoringTask["status"], updatedAt: string) => {
                const record = tasks.get(id);
                if (record) tasks.set(id, { ...record, status, updatedAt });
            }),
            updateTitle: vi.fn(async (id: string, title: string, slug: MonitoringTask["slug"], updatedAt: string) => {
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
        notifier,
    } as unknown as TestPorts;

    return {
        ports,
        taskLifecycle: new TaskLifecycleService(ports.tasks, ports.sessions, ports.events, ports.notifier),
        tasks,
        sessions,
        events,
        notifier,
        mocks: {
            sessionsCreate,
            sessionsUpdateStatus,
        },
    };
}
