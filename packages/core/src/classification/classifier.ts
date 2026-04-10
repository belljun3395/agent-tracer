import type { EventClassification, EventClassificationMatch } from "../domain.js";
import type { ClassifyEventInput } from "./classifier.types.js";
import { classifyActionName } from "./action-registry.js";
import { defaultLaneForEventKind } from "../domain.js";
import { getCanonicalLane } from "./classifier.helpers.js";

/**
 * Produces the final event classification by combining explicit, canonical, and inferred lanes.
 */
export function classifyEvent(input: ClassifyEventInput): EventClassification {
    const actionMatch = classifyActionName(input.actionName);
    const matches: EventClassificationMatch[] = actionMatch ? [actionMatch] : [];
    const canonicalLane = getCanonicalLane(input.kind);
    return {
        lane: input.lane ?? canonicalLane ?? matches.find((match) => match.lane)?.lane ?? defaultLaneForEventKind(input.kind),
        tags: [...new Set(matches.flatMap((match) => match.tags))],
        matches
    };
}
export type { ClassifyEventInput } from "./classifier.types.js";
