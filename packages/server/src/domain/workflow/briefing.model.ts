import type { BriefingFormat, BriefingPurpose } from "./briefing.type.js";

export interface SavedBriefing {
    readonly id: string;
    readonly taskId: string;
    readonly generatedAt: string;
    readonly purpose: BriefingPurpose;
    readonly format: BriefingFormat;
    readonly memo: string | null;
    readonly content: string;
}
