import type { TimelineLane } from "../../types.js";

export interface ObservabilityStats {
    readonly actions: number;
    readonly coordinationActivities: number;
    readonly exploredFiles: number;
    readonly checks: number;
    readonly violations: number;
    readonly passes: number;
    readonly compactions: number;
}
export interface ExploredFileStat {
    readonly path: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly readTimestamps: readonly string[];
    readonly compactRelation: CompactRelation;
    readonly explorationSources?: readonly string[] | undefined;
}
export interface WebLookupStat {
    readonly url: string;
    readonly toolName: string;
    readonly count: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly compactRelation: CompactRelation;
}
export type CompactRelation = "before-compact" | "after-compact" | "across-compact" | "no-compact";
export interface FileActivityStat {
    readonly path: string;
    readonly readCount: number;
    readonly writeCount: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly compactRelation: CompactRelation;
}
export interface ExplorationInsight {
    readonly totalExplorations: number;
    readonly uniqueFiles: number;
    readonly uniqueWebLookups: number;
    readonly toolBreakdown: Readonly<Record<string, number>>;
    readonly preCompactFiles: number;
    readonly postCompactFiles: number;
    readonly acrossCompactFiles: number;
    readonly preCompactWebLookups: number;
    readonly postCompactWebLookups: number;
    readonly acrossCompactWebLookups: number;
    readonly firstExplorationAt?: string | undefined;
    readonly lastExplorationAt?: string | undefined;
}
export interface SubagentInsight {
    readonly delegations: number;
    readonly backgroundTransitions: number;
    readonly linkedBackgroundEvents: number;
    readonly uniqueAsyncTasks: number;
    readonly completedAsyncTasks: number;
    readonly unresolvedAsyncTasks: number;
}
export interface CompactInsight {
    readonly occurrences: number;
    readonly handoffCount: number;
    readonly eventCount: number;
    readonly beforeCount: number;
    readonly afterCount: number;
    readonly lastSeenAt?: string | undefined;
    readonly latestTitle?: string | undefined;
    readonly latestBody?: string | undefined;
    readonly tagFacets: readonly string[];
}
export interface RuleDecisionStat {
    readonly id: string;
    readonly ruleId: string;
    readonly title: string;
    readonly status: string;
    readonly outcome?: string | undefined;
    readonly severity?: string | undefined;
    readonly reviewerId?: string | undefined;
    readonly reviewerSource?: string | undefined;
    readonly note?: string | undefined;
    readonly createdAt: string;
}
export interface SubagentInsight {
    readonly delegations: number;
    readonly backgroundTransitions: number;
    readonly linkedBackgroundEvents: number;
    readonly uniqueAsyncTasks: number;
    readonly completedAsyncTasks: number;
    readonly unresolvedAsyncTasks: number;
}
export interface TagInsight {
    readonly tag: string;
    readonly count: number;
    readonly lanes: readonly TimelineLane[];
    readonly ruleIds: readonly string[];
    readonly lastSeenAt: string;
}
export interface TaskProcessSection {
    readonly lane: TimelineLane;
    readonly title: string;
    readonly items: readonly string[];
}
export interface TaskExtraction {
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly validations: readonly string[];
    readonly files: readonly string[];
    readonly brief: string;
    readonly processMarkdown: string;
}
export interface TimelineFilterOptions {
    readonly laneFilters: Readonly<Record<TimelineLane, boolean>>;
    readonly selectedTag?: string | null;
    readonly selectedRuleId?: string | null;
    readonly showRuleGapsOnly?: boolean;
}
