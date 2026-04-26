import { buildCompactInsight, buildObservabilityStats, collectExploredFiles } from "~app/lib/insights/aggregation.js";
import { collectRecentRuleDecisions } from "~app/lib/insights/extraction.js";
import { buildModelSummary } from "~app/lib/insights/grouping.js";
import type { ModelSummary } from "~app/lib/insights/grouping.js";
import type { CompactInsight, ObservabilityStats, RuleDecisionStat } from "~app/lib/insights/types.js";
import type { ExploredFileStat } from "~app/lib/insights/types.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface TaskTimelineSummary {
    readonly exploredFiles: readonly ExploredFileStat[];
    readonly compactInsight: CompactInsight;
    readonly observabilityStats: ObservabilityStats;
    readonly modelSummary: ModelSummary;
    readonly recentRuleDecisions: readonly RuleDecisionStat[];
}

export function buildTaskTimelineSummary(timeline: readonly TimelineEventRecord[]): TaskTimelineSummary {
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
