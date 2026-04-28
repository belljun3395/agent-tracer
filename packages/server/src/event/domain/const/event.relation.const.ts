import type { TimelineEvent } from "../model/timeline.event.model.js";

export const TRACE_LINK_ELIGIBLE_KINDS: ReadonlySet<TimelineEvent["kind"]> = new Set([
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "agent.activity.logged",
    "file.changed",
]);
