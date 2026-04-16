import { TaskSlug, WorkspacePath } from "./ids.js";
import type { MonitoringEventKind, MonitoringTaskInput, TimelineLane } from "./types.js";

/**
 * Normalizes arbitrary workspace path input into the branded workspace path type.
 */
export function normalizeWorkspacePath(path: string) {
    return WorkspacePath(path);
}

/**
 * Derives the stable task slug used for storage and lookup from task input.
 */
export function createTaskSlug(input: MonitoringTaskInput) {
    return TaskSlug(input.title);
}

/**
 * Supplies the default lane for an event kind when no stronger signal exists.
 */
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
        case "instructions.loaded":
            return "exploration";
    }
}

/**
 * Coerces lane aliases and legacy labels into the canonical timeline lane set.
 */
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
