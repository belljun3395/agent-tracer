import { KIND, type TimelineEvent } from "~domain/index.js";

export const NON_EXPLORATION_TOOL_KINDS: ReadonlySet<TimelineEvent["kind"]> = new Set([
    KIND.instructionsLoaded,
    KIND.userMessage,
]);
