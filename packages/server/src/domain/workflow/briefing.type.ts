import type { BRIEFING_FORMATS, BRIEFING_PURPOSES } from "./briefing.const.js";

export type BriefingPurpose = (typeof BRIEFING_PURPOSES)[number];
export type BriefingFormat = (typeof BRIEFING_FORMATS)[number];
