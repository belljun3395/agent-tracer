import {
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
} from "./const/task.status.const.js";
import type {
    EventRelationType,
    EvidenceLevel,
} from "./type/task.status.type.js";

const EVIDENCE_LEVEL_SET = new Set<string>(EVIDENCE_LEVELS);
const EVENT_RELATION_TYPE_SET = new Set<string>(EVENT_RELATION_TYPES);

export function isEvidenceLevel(value: string | undefined): value is EvidenceLevel {
    return value !== undefined && EVIDENCE_LEVEL_SET.has(value);
}

export function isEventRelationType(value: string | undefined): value is EventRelationType {
    return value !== undefined && EVENT_RELATION_TYPE_SET.has(value);
}
