import type { MonitoringEventKind, MonitoringTaskInput, TimelineLane } from "./types.js";
export function normalizeWorkspacePath(path: string): string {
    const normalized = path.trim().replace(/\/+/g, "/");
    return normalized.endsWith("/") && normalized !== "/"
        ? normalized.slice(0, -1)
        : normalized;
}
export function createTaskSlug(input: MonitoringTaskInput): string {
    const source = input.title.trim().toLowerCase();
    return source
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}
export function defaultLaneForEventKind(kind: MonitoringEventKind): TimelineLane {
    switch (kind) {
        case "verification.logged":
        case "rule.logged":
            return "implementation";
        case "action.logged":
            return "implementation";
        case "agent.activity.logged":
            return "coordination";
        case "plan.logged":
        case "context.saved":
            return "planning";
        case "file.changed":
            return "implementation";
        case "terminal.command":
        case "tool.used":
            return "implementation";
        case "task.start":
        case "task.complete":
        case "task.error":
        case "user.message":
            return "user";
        case "question.logged":
            return "questions";
        case "todo.logged":
            return "todos";
        case "thought.logged":
            return "planning";
        case "assistant.response":
            return "user";
    }
}
export function normalizeLane(raw: string): TimelineLane {
    switch (raw) {
        case "file":
            return "exploration";
        case "terminal":
        case "tool":
            return "implementation";
        case "thought":
        case "thoughts":
            return "planning";
        case "message":
            return "user";
        case "rules":
            return "implementation";
        case "user":
        case "exploration":
        case "planning":
        case "implementation":
        case "questions":
        case "todos":
        case "background":
        case "coordination":
            return raw as TimelineLane;
        default:
            return "user";
    }
}
