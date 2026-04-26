import type React from "react";
import { useState } from "react";
import { cn } from "../../lib/ui/cn.js";
import { Button } from "../ui/Button.js";
import { tabButtonClass } from "../knowledge/primitives.js";
import type { RuleRecord } from "../../../types.js";
import { useRules } from "./useRules.js";
import { RuleForm, type RuleFormValues } from "./RuleForm.js";
import { RuleListItem, RuleEmptyState } from "./RuleListItem.js";

type RuleTab = "all" | "global" | "task";

const tabActiveClass = "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]";
const tabInactiveClass = "border-[var(--border)] bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)]";

export interface RulesContentProps {
    /** When set, the page only shows rules for this task and "+ New Rule" prefills task scope. */
    readonly taskId?: string;
}

function ruleToFormValues(rule: RuleRecord): RuleFormValues {
    return {
        name: rule.name,
        phrases: rule.trigger?.phrases.join(", ") ?? "",
        triggerOn: rule.triggerOn ?? "",
        tool: rule.expect.tool ?? "",
        commandMatches: rule.expect.commandMatches?.join(", ") ?? "",
        pattern: rule.expect.pattern ?? "",
        severity: rule.severity,
    };
}

export function RulesContent({ taskId }: RulesContentProps = {}): React.JSX.Element {
    const isTaskMode = typeof taskId === "string" && taskId.length > 0;
    const opts = isTaskMode ? { taskId } : {};
    const {
        rules,
        global: globalRules,
        task: taskRules,
        deleteRule,
        create,
        update,
        promote,
        reEvaluate,
    } = useRules(opts);
    const [activeTab, setActiveTab] = useState<RuleTab>("all");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [promotingRuleId, setPromotingRuleId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const findRuleValues = (id: string): RuleFormValues | null => {
        const rule = rules.find((r) => r.id === id);
        return rule ? ruleToFormValues(rule) : null;
    };

    const renderActionsForRule = (rule: RuleRecord): React.ReactNode => {
        const editBtn = (
            <Button size="sm" variant="ghost" onClick={() => {
                setEditingRuleId(rule.id);
                setPromotingRuleId(null);
                setIsFormOpen(false);
            }}>Edit</Button>
        );
        const reEvaluateBtn = (
            <Button size="sm" variant="ghost" onClick={() => {
                void reEvaluate(rule.id).then((result) => {
                    setToast(`Re-evaluated: ${result.turnsEvaluated} turns checked, ${result.verdictsCreated} new verdict(s) created.`);
                });
            }}>Re-evaluate</Button>
        );
        const deleteBtn = (
            <Button size="sm" variant="ghost" onClick={() => void deleteRule(rule.id)}>Delete</Button>
        );
        if (rule.scope === "task") {
            return (
                <>
                    {editBtn}
                    {reEvaluateBtn}
                    <Button size="sm" variant="ghost" onClick={() => {
                        setPromotingRuleId(rule.id);
                        setEditingRuleId(null);
                        setIsFormOpen(false);
                    }}>Promote to Global</Button>
                    {deleteBtn}
                </>
            );
        }
        return <>{editBtn}{reEvaluateBtn}{deleteBtn}</>;
    };

    const editingValues = editingRuleId ? findRuleValues(editingRuleId) : null;
    const editingInitial = editingRuleId !== null && editingValues !== null
        ? { id: editingRuleId, values: editingValues }
        : undefined;
    const isEditing = editingInitial !== undefined;

    const promotingValues = promotingRuleId ? findRuleValues(promotingRuleId) : null;
    const promotingInitial = promotingRuleId !== null && promotingValues !== null
        ? { id: promotingRuleId, values: promotingValues }
        : undefined;
    const isPromoting = promotingInitial !== undefined;

    const visibleRules = isTaskMode
        ? rules
        : (activeTab === "all" ? rules : activeTab === "global" ? globalRules : taskRules);

    const headerLabel = isTaskMode ? `Task Rules · ${taskId}` : "Rules";

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
                <span className="text-[0.88rem] font-semibold text-[var(--text-1)]">{headerLabel}</span>
                {!isTaskMode && (
                    <div className="flex gap-1">
                        {([
                            ["all", `All (${rules.length})`],
                            ["global", `Global (${globalRules.length})`],
                            ["task", `Task (${taskRules.length})`],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={cn(tabButtonClass, activeTab === value ? tabActiveClass : tabInactiveClass)}
                                onClick={() => { setActiveTab(value); }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex-1"/>
                {!isEditing && !isPromoting && (
                    <Button size="sm" variant="accent" onClick={() => setIsFormOpen((v) => !v)}>
                        {isFormOpen ? "Close" : "+ New Rule"}
                    </Button>
                )}
            </div>

            {toast && (
                <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] px-4 py-2 text-[0.72rem] text-[var(--text-2)]">
                    {toast}
                    <button type="button" className="ml-2 underline" onClick={() => setToast(null)}>dismiss</button>
                </div>
            )}

            {(isFormOpen || isEditing || isPromoting) && (
                <div className="border-b border-[var(--border)] px-4 py-3">
                    <RuleForm
                        {...(editingInitial !== undefined
                            ? { initial: editingInitial, mode: "edit" as const }
                            : promotingInitial !== undefined
                                ? { initial: promotingInitial, mode: "promote" as const }
                                : { mode: "create" as const })}
                        {...(isTaskMode ? { defaultTaskId: taskId } : {})}
                        onCreate={async (input) => {
                            await create(input);
                            setIsFormOpen(false);
                            if (!isTaskMode) setActiveTab("all");
                        }}
                        onUpdate={async (id, patch) => {
                            await update(id, patch);
                            setEditingRuleId(null);
                        }}
                        onPromote={async (id, edits) => {
                            await promote(id, edits);
                            setPromotingRuleId(null);
                            setToast("Promoted to global. Task rule kept — delete it manually if redundant.");
                        }}
                        onCancel={() => {
                            setIsFormOpen(false);
                            setEditingRuleId(null);
                            setPromotingRuleId(null);
                        }}
                    />
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <RuleList
                    items={visibleRules}
                    emptyHeading={isTaskMode ? "No rules for this task yet" : "No rules yet"}
                    emptyDescription={
                        isTaskMode
                            ? "Create a rule above, or open a turn from this task and click \"Suggest rules\" to copy a prompt."
                            : "Open a turn and click \"Suggest rules\" to copy a prompt — or create one above."
                    }
                    renderActions={renderActionsForRule}
                />
            </div>
        </div>
    );
}

interface RuleListProps {
    readonly items: readonly RuleRecord[];
    readonly emptyHeading: string;
    readonly emptyDescription: string;
    readonly renderActions: (rule: RuleRecord) => React.ReactNode;
}

function RuleList({ items, emptyHeading, emptyDescription, renderActions }: RuleListProps): React.JSX.Element {
    if (items.length === 0) {
        return <RuleEmptyState heading={emptyHeading} description={emptyDescription} />;
    }
    return (
        <div>
            {items.map((rule) => (
                <RuleListItem key={rule.id} rule={rule} actions={renderActions(rule)} />
            ))}
        </div>
    );
}
