import type { MonitoringEventKind, TimelineLane } from "../monitoring/types.js";
/**
 * Pins lifecycle and user-facing event kinds to non-overridable canonical lanes.
 */
export declare function getCanonicalLane(kind: MonitoringEventKind): TimelineLane | undefined;
//# sourceMappingURL=classifier.helpers.d.ts.map