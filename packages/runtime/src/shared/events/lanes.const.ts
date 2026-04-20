import type { EventLane } from "./kinds.type.js";

export const LANE = {
    user: "user",
    exploration: "exploration",
    planning: "planning",
    implementation: "implementation",
    rule: "rule",
    questions: "questions",
    todos: "todos",
    background: "background",
    coordination: "coordination",
    telemetry: "telemetry",
} as const satisfies Record<EventLane, EventLane>;
