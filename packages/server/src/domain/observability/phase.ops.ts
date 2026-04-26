import { KIND, readString } from "~domain/index.js";
import type { MonitoringSession, MonitoringTask, TimelineEvent } from "~domain/index.js";
import type { ObservabilityPhaseBucket } from "./observability.metrics.type.js";

export const PHASE_ORDER = [
    "planning",
    "exploration",
    "implementation",
    "verification",
    "coordination",
] as const;

export const WAITING_GAP_THRESHOLD_MS = 90000;

export interface SessionWindow {
    readonly session: MonitoringSession;
    readonly startMs: number;
    readonly endMs: number;
}

export function addDuration(
    phaseDurations: Record<ObservabilityPhaseBucket, number>,
    phase: ObservabilityPhaseBucket,
    durationMs: number,
): void {
    if (durationMs <= 0) return;
    if (phase === "waiting") {
        phaseDurations.waiting += durationMs;
        return;
    }
    const activeDurationMs = Math.min(durationMs, WAITING_GAP_THRESHOLD_MS);
    phaseDurations[phase] += activeDurationMs;
    phaseDurations.waiting += durationMs - activeDurationMs;
}

export function phaseForEvent(event: TimelineEvent): ObservabilityPhaseBucket {
    switch (event.kind) {
        case KIND.userMessage:
            return "waiting";
        case KIND.questionLogged: {
            const phase = readString(event.metadata, "questionPhase");
            return phase === "concluded" ? "planning" : "waiting";
        }
        case KIND.todoLogged:
        case KIND.thoughtLogged:
        case KIND.planLogged:
        case KIND.contextSaved:
        case KIND.taskStart:
            return "planning";
        case KIND.fileChanged:
            return "exploration";
        case KIND.agentActivityLogged:
            return "coordination";
        case KIND.verificationLogged:
        case KIND.ruleLogged:
            return "verification";
        case KIND.actionLogged:
        case KIND.terminalCommand:
        case KIND.toolUsed:
            return phaseFromLane(event.lane);
        case KIND.taskComplete:
        case KIND.taskError:
            return "verification";
        default:
            return phaseFromLane(event.lane);
    }
}

export function buildSessionWindows(
    task: MonitoringTask,
    sessions: readonly MonitoringSession[],
    timeline: readonly TimelineEvent[],
    now: Date,
    taskEndMs: number,
): readonly SessionWindow[] {
    if (sessions.length === 0) return [];
    const sessionStartHints = sessions.map((session) => Date.parse(session.startedAt));
    const eventStartHints = timeline.map((event) => Date.parse(event.createdAt));
    const startCandidates = [Date.parse(task.createdAt), ...sessionStartHints, ...eventStartHints]
        .filter(Number.isFinite);
    const firstKnownStart = startCandidates.length > 0
        ? Math.min(...startCandidates)
        : Date.parse(task.createdAt);
    const windows: SessionWindow[] = [];
    for (let index = 0; index < sessions.length; index += 1) {
        const session = sessions[index]!;
        const sessionStartMs = Math.max(firstKnownStart, Date.parse(session.startedAt));
        const nextSession = sessions[index + 1];
        const explicitEndMs = session.endedAt ? Date.parse(session.endedAt) : undefined;
        const fallbackEndMs = nextSession ? Date.parse(nextSession.startedAt) : taskEndMs;
        const sessionEndMs = Math.max(sessionStartMs, explicitEndMs ?? fallbackEndMs);
        const resolvedEndMs = session.status === "running" || !session.endedAt
            ? Math.max(sessionEndMs, task.status === "running" ? now.getTime() : taskEndMs)
            : sessionEndMs;
        windows.push({ session, startMs: sessionStartMs, endMs: resolvedEndMs });
    }
    return windows;
}

export function collectSessionEvents(input: {
    readonly timeline: readonly TimelineEvent[];
    readonly session: MonitoringSession;
    readonly startMs: number;
    readonly endMs: number;
}): readonly TimelineEvent[] {
    const events: TimelineEvent[] = [];
    for (const event of input.timeline) {
        if (event.sessionId === input.session.id) {
            events.push(event);
            continue;
        }
        if (event.sessionId) continue;
        const eventMs = Date.parse(event.createdAt);
        if (eventMs >= input.startMs && eventMs <= input.endMs) {
            events.push(event);
        }
    }
    return events.sort((left, right) => {
        const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
    });
}

export function resolveTaskStartMs(
    task: MonitoringTask,
    sessions: readonly MonitoringSession[],
    timeline: readonly TimelineEvent[],
): number {
    const candidates = [
        Date.parse(task.createdAt),
        ...sessions.map((session) => Date.parse(session.startedAt)),
        ...timeline.map((event) => Date.parse(event.createdAt)),
    ].filter(Number.isFinite);
    return candidates.length > 0 ? Math.min(...candidates) : Date.parse(task.createdAt);
}

export function resolveTaskEndMs(
    task: MonitoringTask,
    sessions: readonly MonitoringSession[],
    timeline: readonly TimelineEvent[],
    now: Date,
): number {
    if (task.status === "running") return now.getTime();
    const candidates = [
        Date.parse(task.updatedAt),
        ...sessions.map((session) => session.endedAt
            ? Date.parse(session.endedAt)
            : Date.parse(session.startedAt)),
        ...timeline.map((event) => Date.parse(event.createdAt)),
    ].filter(Number.isFinite);
    return candidates.length > 0 ? Math.max(...candidates) : Date.parse(task.updatedAt);
}

function phaseFromLane(lane: TimelineEvent["lane"]): ObservabilityPhaseBucket {
    switch (lane) {
        case "planning":       return "planning";
        case "exploration":    return "exploration";
        case "implementation": return "implementation";
        case "coordination":   return "coordination";
        case "background":     return "coordination";
        case "user":
        case "questions":
        case "todos":
        case "telemetry":
        case "rule":           return "waiting";
    }
}
