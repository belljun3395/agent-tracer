import type { EvidenceLevel } from "~activity/event/domain/common/type/event.meta.type.js";
import { readEvidenceLevel } from "./event.metadata.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

export function resolveEvidenceLevel(event: TimelineEvent): EvidenceLevel {
    const level = readEvidenceLevel(event.metadata);
    if (level === "proven" || level === "inferred" || level === "unavailable") return level;
    return "self_reported";
}
