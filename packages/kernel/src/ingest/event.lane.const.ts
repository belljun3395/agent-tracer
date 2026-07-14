export const EVENT_LANES = [
    "user",
    "assistant",
    "exploration",
    "planning",
    "implementation",
    "questions",
    "todos",
    "background",
    "coordination",
    "telemetry",
    "rule",
] as const;

export const LANE = {
    user: "user",
    assistant: "assistant",
    exploration: "exploration",
    planning: "planning",
    implementation: "implementation",
    questions: "questions",
    todos: "todos",
    background: "background",
    coordination: "coordination",
    telemetry: "telemetry",
    rule: "rule",
} as const satisfies Record<(typeof EVENT_LANES)[number], (typeof EVENT_LANES)[number]>;

export type EventLane = (typeof EVENT_LANES)[number];
