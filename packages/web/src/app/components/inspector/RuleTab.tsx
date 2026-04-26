import type React from "react";
import { useMemo } from "react";
import type { RuleRecord, TaskId, TimelineEventRecord } from "../../../types.js";
import { formatRelativeTime } from "../../../types.js";
import { useRulesQuery } from "../../../state.js";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { HelpTooltip } from "../ui/HelpTooltip.js";
import { cardShell, cardHeader, cardBody, monoText } from "./styles.js";
import { inspectorHelpText } from "./helpText.js";

interface RuleTabProps {
    readonly timeline: readonly TimelineEventRecord[];
    readonly taskId?: TaskId | undefined;
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
}

interface RuleMatch {
    readonly rule: RuleRecord;
    readonly events: readonly TimelineEventRecord[];
}

function rulePatternsForMatching(rule: RuleRecord): readonly string[] {
    const patterns: string[] = [];
    if (rule.expect.commandMatches) {
        patterns.push(...rule.expect.commandMatches);
    }
    if (rule.expect.pattern) {
        patterns.push(rule.expect.pattern);
    }
    return patterns;
}

function matchesPattern(event: TimelineEventRecord, pattern: string): boolean {
    const p = pattern.toLowerCase();
    const cmd = (event.metadata["command"] as string | undefined) ?? "";
    return (
        event.title.toLowerCase().includes(p) ||
        (event.body ?? "").toLowerCase().includes(p) ||
        cmd.toLowerCase().includes(p)
    );
}

function buildRuleMatches(
    rules: readonly RuleRecord[],
    timeline: readonly TimelineEventRecord[],
): readonly RuleMatch[] {
    const ruleEvents = timeline.filter((e) => e.lane === "rule" || e.kind === "rule.logged");
    return rules.map((rule) => {
        const patterns = rulePatternsForMatching(rule);
        const events = patterns.length === 0
            ? []
            : ruleEvents.filter((event) =>
                patterns.some((pattern) => matchesPattern(event, pattern)),
            );
        return { rule, events };
    });
}

function isFlatResponse(
    value: { rules?: readonly RuleRecord[] } | { active?: readonly RuleRecord[] } | undefined,
): value is { rules: readonly RuleRecord[] } {
    return value !== undefined && Array.isArray((value as { rules?: unknown }).rules);
}

function rulesFromResponse(
    response: { rules?: readonly RuleRecord[] } | { active?: readonly RuleRecord[] } | undefined,
): readonly RuleRecord[] {
    if (!response) return [];
    if (isFlatResponse(response)) return response.rules;
    return (response as { active?: readonly RuleRecord[] }).active ?? [];
}

function RuleMatchRow({
    match,
    onSelectEvent,
}: {
    readonly match: RuleMatch;
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
}): React.JSX.Element {
    const { rule, events } = match;
    const executed = events.length > 0;
    const patterns = rulePatternsForMatching(rule);

    return (
        <div className={cn(
            "rounded-[10px] border px-3 py-2.5 flex flex-col gap-2",
            executed
                ? "border-[var(--success-border,#bbf7d0)] bg-[var(--success-bg,#f0fdf4)]"
                : "border-[var(--border)] bg-[var(--surface-2)]",
        )}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                        "shrink-0 h-2 w-2 rounded-full",
                        executed ? "bg-[var(--success,#22c55e)]" : "bg-[var(--text-3)]",
                    )} />
                    <strong className="min-w-0 truncate text-[0.82rem] text-[var(--text-1)]">
                        {rule.name}
                    </strong>
                </div>
                <Badge tone={executed ? "success" : "neutral"} size="xs">
                    {executed ? `${events.length}×` : "not run"}
                </Badge>
            </div>

            <code className={cn("text-[0.72rem] text-[var(--text-2)]", monoText)}>
                {patterns.length > 0 ? patterns.join(" | ") : (rule.expect.tool ?? "(no pattern)")}
            </code>

            {executed && (
                <div className="flex flex-col gap-1.5 mt-0.5">
                    {events.map((event) => (
                        <button
                            key={event.id}
                            type="button"
                            onClick={() => onSelectEvent?.(event.id)}
                            className={cn(
                                "flex items-center justify-between gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-left transition-colors",
                                onSelectEvent
                                    ? "cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-light)]"
                                    : "cursor-default",
                            )}
                        >
                            <span className={cn("min-w-0 flex-1 truncate text-[0.76rem] text-[var(--text-2)]", monoText)}>
                                {event.title}
                            </span>
                            <span className="shrink-0 text-[0.68rem] tabular-nums text-[var(--text-3)]">
                                {formatRelativeTime(event.createdAt)}
                                {onSelectEvent && <span className="ml-1 text-[var(--accent)]">→</span>}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function RuleGroupCard({
    title,
    matches,
    onSelectEvent,
}: {
    readonly title: string;
    readonly matches: readonly RuleMatch[];
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
}): React.JSX.Element {
    const executedCount = matches.filter((m) => m.events.length > 0).length;
    return (
        <PanelCard className={cardShell}>
            <div className={cardHeader}>
                <div className="flex items-start gap-2">
                    <span>{title}</span>
                    <HelpTooltip text={inspectorHelpText.ruleTab} className="mt-0.5" />
                </div>
                <div className="flex items-center gap-1.5">
                    <Badge tone="success" size="xs">{executedCount} run</Badge>
                    <Badge tone="neutral" size="xs">{matches.length - executedCount} pending</Badge>
                </div>
            </div>
            <div className={cardBody}>
                {matches.length === 0 ? (
                    <p className="m-0 text-[0.8rem] text-[var(--text-3)]">No rules configured.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {matches.map((match) => (
                            <RuleMatchRow
                                key={match.rule.id}
                                match={match}
                                onSelectEvent={onSelectEvent}
                            />
                        ))}
                    </div>
                )}
            </div>
        </PanelCard>
    );
}

export function RuleTab({ timeline, taskId, onSelectEvent }: RuleTabProps): React.JSX.Element {
    const globalQuery = useRulesQuery({ scope: "global" });
    const taskQuery = useRulesQuery(
        taskId ? { taskId } : undefined,
    );

    const globalRules = rulesFromResponse(globalQuery.data);
    const allTaskScopedRules = rulesFromResponse(taskQuery.data);
    // The /api/rules?taskId=X endpoint returns global + task rules. Filter to task-only here.
    const taskRules = useMemo(
        () => allTaskScopedRules.filter((r) => r.scope === "task"),
        [allTaskScopedRules],
    );

    const globalMatches = useMemo(
        () => buildRuleMatches(globalRules, timeline),
        [globalRules, timeline],
    );
    const taskMatches = useMemo(
        () => buildRuleMatches(taskRules, timeline),
        [taskRules, timeline],
    );

    const allEmpty = globalRules.length === 0 && taskRules.length === 0;

    if (allEmpty) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">No rules configured.</p>
                <p className="m-0 text-[0.8rem] leading-6 text-[var(--text-3)]">
                    Open the Rules page to add a new rule.
                </p>
            </div>
        );
    }

    return (
        <div className="panel-tab-inner flex flex-col gap-5 p-4">
            {globalRules.length > 0 && (
                <RuleGroupCard
                    title="Global Rules"
                    matches={globalMatches}
                    onSelectEvent={onSelectEvent}
                />
            )}
            {taskRules.length > 0 && (
                <RuleGroupCard
                    title="Task Rules"
                    matches={taskMatches}
                    onSelectEvent={onSelectEvent}
                />
            )}
        </div>
    );
}
