import type { EventClassification } from "./types.js";
import type { ClassifyEventInput } from "./classifier.types.js";
/**
 * Produces the final event classification by combining explicit, canonical, and inferred lanes.
 */
export declare function classifyEvent(input: ClassifyEventInput): EventClassification;
export type { ClassifyEventInput } from "./classifier.types.js";
//# sourceMappingURL=classifier.d.ts.map