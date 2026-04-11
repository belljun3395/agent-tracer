import { classifyActionName } from "./action-registry.js";
import { defaultLaneForEventKind } from "../monitoring/utils.js";
import { getCanonicalLane } from "./classifier.helpers.js";
/**
 * Produces the final event classification by combining explicit, canonical, and inferred lanes.
 */
export function classifyEvent(input) {
    const actionMatch = classifyActionName(input.actionName);
    const matches = actionMatch ? [actionMatch] : [];
    const canonicalLane = getCanonicalLane(input.kind);
    return {
        lane: input.lane ?? canonicalLane ?? matches.find((match) => match.lane)?.lane ?? defaultLaneForEventKind(input.kind),
        tags: [...new Set(matches.flatMap((match) => match.tags))],
        matches
    };
}
//# sourceMappingURL=classifier.js.map