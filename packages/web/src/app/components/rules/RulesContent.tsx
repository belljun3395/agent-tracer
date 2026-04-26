import type React from "react";
import { useMemo, useState } from "react";
import type {
    RuleCreateInput,
    RuleRecord,
    RuleScope,
    RuleSeverity,
    RuleSource,
    RuleUpdateInput,
    TaskRulesResponse,
    TaskId,
} from "../../../types.js";
import { useRulesQuery, useTaskRulesQuery, useTasksQuery } from "../../../state.js";
import { cn } from "../../lib/ui/cn.js";
import { Button } from "../ui/Button.js";
import { RuleDialog } from "./RuleDialog.js";
import { RuleListItem } from "./RuleListItem.js";
import { labelRuleExpectTool } from "./ruleExpectTool.js";
import {
    useCreateRuleMutation,
    useDeleteRuleMutation,
    usePromoteRuleMutation,
    useReEvaluateRuleMutation,
    useUpdateRuleMutation,
} from "./useRules.js";

type RuleScopeFilter = RuleScope | "all";
type RuleDialogState =
    | { readonly mode: "create" }
    | { readonly mode: "edit"; readonly id: string }
    | null;

interface RulesContentProps {
    readonly defaultScope?: RuleScopeFilter;
    readonly defaultTaskId?: TaskId;
    /** Hide the scope filter when constrained to a single task. */
    readonly lockScope?: boolean;
    readonly variant?: "page" | "panel";
}

/**
 * Full rules management surface. Used both by the standalone /rules page and
 * by the inspector RuleTab (which passes lockScope and a defaultTaskId).
 */
export function RulesContent({
    defaultScope = "all",
    defaultTaskId,
    lockScope = false,
    variant = "panel",
}: RulesContentProps): React.JSX.Element {
    const isPage = variant === "page";
    const [scope, setScope] = useState<RuleScopeFilter>(() => lockScope && defaultScope === "all" ? "global" : defaultScope);
    const [dialog, setDialog] = useState<RuleDialogState>(null);
    const [query, setQuery] = useState("");
    const [severity, setSeverity] = useState<RuleSeverity | "all">("all");
    const [source, setSource] = useState<RuleSource | "all">("all");

    const { data: tasksData } = useTasksQuery();
    const tasks = tasksData?.tasks ?? [];

    const filter = useMemo(() => {
        if (scope === "all") {
            return undefined;
        }
        if (scope === "task" && defaultTaskId) {
            return { scope: "task" as const, taskId: defaultTaskId };
        }
        return { scope };
    }, [scope, defaultTaskId]);

    const useAppliedTaskRules = scope === "task" && defaultTaskId !== undefined;
    const rulesQuery = useRulesQuery(filter, { enabled: !useAppliedTaskRules });
    const taskRulesQuery = useTaskRulesQuery(useAppliedTaskRules ? defaultTaskId : null);
    const rules = rulesForDisplay({
        scope,
        rules: rulesQuery.data?.rules,
        taskRules: taskRulesQuery.data,
    });
    const filteredRules = useMemo(
        () => rules.filter((rule) => matchesRuleFilters(rule, query, severity, source)),
        [query, rules, severity, source],
    );
    const counts = useMemo(() => summarizeRules(rules), [rules]);

    const createRule = useCreateRuleMutation();
    const updateRule = useUpdateRuleMutation();
    const deleteRule = useDeleteRuleMutation();
    const promoteRule = usePromoteRuleMutation();
    const reEvaluate = useReEvaluateRuleMutation();

    const editingRule = useMemo(
        () => dialog?.mode === "edit" ? rules.find((r) => r.id === dialog.id) ?? null : null,
        [dialog, rules],
    );
    const createDefaultScope: RuleScope = scope === "task" && defaultTaskId ? "task" : "global";
    const createDefaultTaskId = createDefaultScope === "task" ? defaultTaskId : undefined;

    const handleCreate = (input: RuleCreateInput): void => {
        createRule.mutate(input, {
            onSuccess: () => setDialog(null),
        });
    };

    const handleUpdate = (rule: RuleRecord, input: RuleCreateInput): void => {
        updateRule.mutate({
            id: rule.id,
            patch: buildRuleUpdatePatch(input),
        }, {
            onSuccess: () => setDialog(null),
        });
    };

    const taskNameFor = (taskId: string | undefined): string | null => {
        if (!taskId) return null;
        const t = tasks.find((task) => task.id === taskId);
        return t?.title ?? taskId;
    };

    const busy = createRule.isPending || updateRule.isPending || deleteRule.isPending
        || promoteRule.isPending || reEvaluate.isPending;
    const isLoading = useAppliedTaskRules ? taskRulesQuery.isLoading : rulesQuery.isLoading;
    const isError = useAppliedTaskRules ? taskRulesQuery.isError : rulesQuery.isError;
    const refetchRules = useAppliedTaskRules ? taskRulesQuery.refetch : rulesQuery.refetch;
    const activeMutationError = createRule.error?.message
        ?? updateRule.error?.message
        ?? null;
    const dialogMode = dialog?.mode ?? "create";
    const dialogScope = editingRule?.scope ?? createDefaultScope;
    const dialogTaskId = editingRule?.taskId ?? createDefaultTaskId;

    return (
        <div className={cn("flex h-full min-h-0 flex-col", isPage ? "gap-3 p-3" : "gap-3 p-3")}>
            <header className={cn(
                "flex shrink-0 items-start justify-between gap-3",
                isPage && "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3",
            )}>
                <div className="min-w-0">
                    <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Verification</p>
                    <h2 className={cn("m-0 mt-0.5 font-semibold text-[var(--text-1)]", isPage ? "text-[1.05rem]" : "text-[0.95rem]")}>
                        Rules
                    </h2>
                    {isPage && (
                        <p className="m-0 mt-1 text-[0.78rem] leading-5 text-[var(--text-2)]">
                            Manage streaming event classification and definitive turn verdict rules.
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void refetchRules()}>
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        variant="accent"
                        onClick={() => setDialog({ mode: "create" })}
                        disabled={busy}
                    >
                        {createDefaultScope === "task" ? "New task rule" : "New global rule"}
                    </Button>
                </div>
            </header>

            <div className={cn(
                "min-h-0 flex-1 gap-3",
                isPage ? "grid overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]" : "flex flex-col overflow-hidden",
            )}>
                <aside className={cn(
                    "flex shrink-0 flex-col gap-3",
                    isPage ? "overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3" : "",
                )}>
                    <RuleFilters
                        scope={scope}
                        lockScope={lockScope}
                        hasTaskScope={defaultTaskId !== undefined}
                        query={query}
                        severity={severity}
                        source={source}
                        onScopeChange={setScope}
                        onQueryChange={setQuery}
                        onSeverityChange={setSeverity}
                        onSourceChange={setSource}
                    />
                    <RuleSummary counts={counts} />
                </aside>

                <section className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-hidden",
                    isPage && "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]",
                )}>
                    <div className={cn("flex shrink-0 items-center justify-between gap-2", isPage ? "border-b border-[var(--border)] px-4 py-3" : "")}>
                        <span className="text-[0.78rem] font-semibold text-[var(--text-2)]">
                            {filteredRules.length} rule{filteredRules.length === 1 ? "" : "s"}
                        </span>
                        {scope === "task" && defaultTaskId === undefined && (
                            <span className="text-[0.72rem] text-[var(--text-3)]">Task rules keep their original task scope.</span>
                        )}
                    </div>

                    <div className={cn("min-h-0 flex-1 overflow-y-auto", isPage ? "p-3" : "")}>
                        {isLoading && <p className="text-[0.82rem] text-[var(--text-2)]">Loading rules...</p>}
                        {isError && <p className="text-[0.82rem] text-[var(--err)]">Failed to load rules.</p>}
                        {!isLoading && !isError && filteredRules.length === 0 && (
                            <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-6 text-center text-[0.82rem] text-[var(--text-2)]">
                                No rules match the current filters.
                            </p>
                        )}
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                            {filteredRules.map((rule) => (
                                <RuleListItem
                                    key={rule.id}
                                    rule={rule}
                                    variant={variant}
                                    taskName={taskNameFor(rule.taskId)}
                                    busy={busy}
                                    onEdit={(r) => setDialog({ mode: "edit", id: r.id })}
                                    onDelete={(r) => {
                                        if (window.confirm(`Delete rule "${r.name}"? Past verdicts are preserved.`)) {
                                            deleteRule.mutate({ id: r.id, ...(r.taskId ? { taskId: r.taskId } : {}) });
                                        }
                                    }}
                                    onPromote={(r) => {
                                        promoteRule.mutate({ id: r.id, ...(r.taskId ? { taskId: r.taskId } : {}) });
                                    }}
                                    onReEvaluate={(r) => {
                                        reEvaluate.mutate({ id: r.id, ...(r.taskId ? { taskId: r.taskId } : {}) });
                                    }}
                                />
                            ))}
                        </ul>
                    </div>
                </section>
            </div>

            <RuleDialog
                mode={dialogMode}
                open={dialog !== null && (dialog.mode === "create" || editingRule !== null)}
                defaultScope={dialogScope}
                {...(dialogTaskId !== undefined ? { defaultTaskId: dialogTaskId } : {})}
                {...(editingRule !== null ? { initial: editingRule } : {})}
                busy={dialogMode === "create" ? createRule.isPending : updateRule.isPending}
                error={activeMutationError}
                onSubmit={(input) => {
                    if (editingRule) handleUpdate(editingRule, input);
                    else handleCreate(input);
                }}
                onClose={() => setDialog(null)}
            />
        </div>
    );
}

function RuleFilters({
    scope,
    lockScope,
    hasTaskScope,
    query,
    severity,
    source,
    onScopeChange,
    onQueryChange,
    onSeverityChange,
    onSourceChange,
}: {
    readonly scope: RuleScopeFilter;
    readonly lockScope: boolean;
    readonly hasTaskScope: boolean;
    readonly query: string;
    readonly severity: RuleSeverity | "all";
    readonly source: RuleSource | "all";
    readonly onScopeChange: (scope: RuleScopeFilter) => void;
    readonly onQueryChange: (query: string) => void;
    readonly onSeverityChange: (severity: RuleSeverity | "all") => void;
    readonly onSourceChange: (source: RuleSource | "all") => void;
}): React.JSX.Element {
    return (
        <div className="flex flex-col gap-2">
            <input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search rules"
                className={inputClass}
            />
            {!lockScope && (
                <select value={scope} onChange={(event) => onScopeChange(event.target.value as RuleScopeFilter)} className={inputClass}>
                    <option value="all">All scopes</option>
                    <option value="global">Global</option>
                    <option value="task">{hasTaskScope ? "This task" : "Task-scoped"}</option>
                </select>
            )}
            <div className="grid grid-cols-2 gap-2">
                <select value={severity} onChange={(event) => onSeverityChange(event.target.value as RuleSeverity | "all")} className={inputClass}>
                    <option value="all">All severity</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="block">Block</option>
                </select>
                <select value={source} onChange={(event) => onSourceChange(event.target.value as RuleSource | "all")} className={inputClass}>
                    <option value="all">All sources</option>
                    <option value="human">Human</option>
                    <option value="agent">Agent</option>
                </select>
            </div>
        </div>
    );
}

function RuleSummary({ counts }: { readonly counts: RuleSummaryCounts }): React.JSX.Element {
    return (
        <div className="grid grid-cols-2 gap-2">
            <SummaryTile label="Total" value={counts.total} />
            <SummaryTile label="Global" value={counts.global} />
            <SummaryTile label="Task" value={counts.task} />
            <SummaryTile label="Block" value={counts.block} />
        </div>
    );
}

function SummaryTile({ label, value }: { readonly label: string; readonly value: number }): React.JSX.Element {
    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <p className="m-0 text-[0.66rem] font-bold uppercase tracking-[0.06em] text-[var(--text-3)]">{label}</p>
            <p className="m-0 mt-0.5 text-[1rem] font-semibold text-[var(--text-1)]">{value}</p>
        </div>
    );
}

interface RuleSummaryCounts {
    readonly total: number;
    readonly global: number;
    readonly task: number;
    readonly block: number;
}

function summarizeRules(rules: readonly RuleRecord[]): RuleSummaryCounts {
    return {
        total: rules.length,
        global: rules.filter((rule) => rule.scope === "global").length,
        task: rules.filter((rule) => rule.scope === "task").length,
        block: rules.filter((rule) => rule.severity === "block").length,
    };
}

function matchesRuleFilters(
    rule: RuleRecord,
    query: string,
    severity: RuleSeverity | "all",
    source: RuleSource | "all",
): boolean {
    if (severity !== "all" && rule.severity !== severity) return false;
    if (source !== "all" && rule.source !== source) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
        rule.name,
        rule.rationale ?? "",
        rule.trigger?.phrases.join(" ") ?? "",
        rule.expect.tool ?? "",
        rule.expect.tool ? labelRuleExpectTool(rule.expect.tool) : "",
        rule.expect.commandMatches?.join(" ") ?? "",
        rule.expect.pattern ?? "",
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
}

const inputClass = "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[0.78rem] text-[var(--text-1)] outline-none focus:border-[var(--accent)]";

export function rulesForDisplay({
    scope,
    rules,
    taskRules,
}: {
    readonly scope: RuleScopeFilter;
    readonly rules?: readonly RuleRecord[] | undefined;
    readonly taskRules?: TaskRulesResponse | undefined;
}): readonly RuleRecord[] {
    if (scope === "task" && taskRules) {
        return [...taskRules.task, ...taskRules.global];
    }
    return rules ?? [];
}

export function buildRuleUpdatePatch(input: RuleCreateInput): RuleUpdateInput {
    return {
        name: input.name,
        ...(input.trigger ? { trigger: input.trigger } : { trigger: null }),
        ...(input.triggerOn ? { triggerOn: input.triggerOn } : { triggerOn: null }),
        expect: {
            tool: input.expect.tool ?? null,
            commandMatches: input.expect.commandMatches ?? null,
            pattern: input.expect.pattern ?? null,
        },
        ...(input.severity ? { severity: input.severity } : {}),
        rationale: input.rationale ?? null,
    };
}
