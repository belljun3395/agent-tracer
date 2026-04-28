import { KIND } from "~event/domain/common/const/event.kind.const.js";
import type { TimelineEvent } from "../model/timeline.event.model.js";

export const NON_EXPLORATION_TOOL_KINDS: ReadonlySet<TimelineEvent["kind"]> = new Set([
    KIND.instructionsLoaded,
    KIND.userMessage,
]);
