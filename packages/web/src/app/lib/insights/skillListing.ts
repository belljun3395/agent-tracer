import type { TimelineEventRecord } from "../../types.js";

export interface SkillListingSummary {
    readonly latestCount: number | null;
    readonly latestAt: string | null;
    readonly loads: number;
    readonly hasInitialLoad: boolean;
}

export function summarizeSkillListing(timeline: readonly TimelineEventRecord[]): SkillListingSummary {
    let latestCount: number | null = null;
    let latestAt: string | null = null;
    let loads = 0;
    let hasInitialLoad = false;
    for (const event of timeline) {
        if (event.kind !== "instructions.loaded") continue;
        if (event.metadata["attachmentType"] !== "skill_listing") continue;
        loads += 1;
        if (event.metadata["isInitial"] === true) hasInitialLoad = true;
        const count = event.metadata["skillCount"];
        if (typeof count === "number" && Number.isFinite(count)) {
            latestCount = count;
            latestAt = event.createdAt;
        }
    }
    return { latestCount, latestAt, loads, hasInitialLoad };
}
