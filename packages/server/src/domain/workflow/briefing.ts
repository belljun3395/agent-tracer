import { BRIEFING_FORMATS, BRIEFING_PURPOSES } from "./briefing.const.js";
import type { BriefingFormat, BriefingPurpose } from "./briefing.type.js";

export * from "./briefing.const.js";
export type * from "./briefing.type.js";
export type * from "./briefing.model.js";

const BRIEFING_PURPOSE_SET = new Set<string>(BRIEFING_PURPOSES);
const BRIEFING_FORMAT_SET = new Set<string>(BRIEFING_FORMATS);

export function isBriefingPurpose(value: string | undefined): value is BriefingPurpose {
    return value !== undefined && BRIEFING_PURPOSE_SET.has(value);
}

export function isBriefingFormat(value: string | undefined): value is BriefingFormat {
    return value !== undefined && BRIEFING_FORMAT_SET.has(value);
}
