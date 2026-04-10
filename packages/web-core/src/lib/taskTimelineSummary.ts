import { buildCompactInsight, buildModelSummary, buildObservabilityStats, collectExploredFiles, collectRecentRuleDecisions, type CompactInsight, type ModelSummary, type ObservabilityStats, type RuleDecisionStat } from "./insights.js";
import type { ExploredFileStat } from "./insights.js";
import type { TimelineEvent } from "../types.js";

export interface TaskTimelineSummary {
    readonly exploredFiles: readonly ExploredFileStat[];
    readonly compactInsight: CompactInsight;
    readonly observabilityStats: ObservabilityStats;
    readonly modelSummary: ModelSummary;
    readonly recentRuleDecisions: readonly RuleDecisionStat[];
}

export function buildTaskTimelineSummary(timeline: readonly TimelineEvent[]): TaskTimelineSummary {
    const exploredFiles = collectExploredFiles(timeline);
    const compactInsight = buildCompactInsight(timeline);
    return {
        exploredFiles,
        compactInsight,
        observabilityStats: buildObservabilityStats(timeline, exploredFiles.length, compactInsight.occurrences),
        modelSummary: buildModelSummary(timeline),
        recentRuleDecisions: collectRecentRuleDecisions(timeline)
    };
}
