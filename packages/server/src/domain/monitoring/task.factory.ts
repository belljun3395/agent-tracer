import { isTimelineLane, type TimelineLane } from "./event.kind.js";
import type { MonitoringTaskInput } from "./monitoring.task.js";

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "task";
}

export function normalizeWorkspacePath(path: string): string {
    return path.replace(/\/+/g, "/").replace(/\/$/, "").trim();
}

export function createTaskSlug(input: MonitoringTaskInput): string {
    return slugify(input.title);
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
        default:
            return isTimelineLane(raw) ? raw : "user";
    }
}
