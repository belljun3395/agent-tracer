import type React from "react";
import type { RuleRecord } from "../../../types.js";
import { cn } from "../../lib/ui/cn.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { labelRuleExpectTool } from "./ruleExpectTool.js";

interface RuleListItemProps {
    readonly rule: RuleRecord;
    readonly variant?: "page" | "panel";
    readonly taskName?: string | null;
    readonly onEdit?: (rule: RuleRecord) => void;
    readonly onDelete?: (rule: RuleRecord) => void;
    readonly onPromote?: (rule: RuleRecord) => void;
    readonly onReEvaluate?: (rule: RuleRecord) => void;
    readonly busy?: boolean | undefined;
}

const SEVERITY_LABELS: Record<RuleRecord["severity"], string> = {
    info: "Info",
    warn: "Warn",
    block: "Block",
};

const SCOPE_LABELS: Record<RuleRecord["scope"], string> = {
    global: "Global",
    task: "Task",
};

const SEVERITY_TONES: Record<RuleRecord["severity"], NonNullable<React.ComponentProps<typeof Badge>["tone"]>> = {
    info: "accent",
    warn: "warning",
    block: "danger",
};

export function RuleListItem({
    rule,
    variant = "panel",
    taskName,
    onEdit,
    onDelete,
    onPromote,
    onReEvaluate,
    busy,
}: RuleListItemProps): React.JSX.Element {
    const isPage = variant === "page";
    return (
        <li className={cn(
            "flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]",
            isPage ? "px-4 py-3" : "px-3 py-2.5",
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("min-w-0 truncate font-semibold text-[var(--text-1)]", isPage ? "text-[0.95rem]" : "text-[0.85rem]")}>{rule.name}</span>
                        <Badge tone="neutral" size="xs">{SCOPE_LABELS[rule.scope]}</Badge>
                        <Badge tone={SEVERITY_TONES[rule.severity]} size="xs">{SEVERITY_LABELS[rule.severity]}</Badge>
                        <Badge tone="neutral" size="xs">{rule.source === "agent" ? "Agent" : "Human"}</Badge>
                        {taskName && <Badge tone="neutral" size="xs">{taskName}</Badge>}
                    </div>
                    {rule.rationale && (
                        <p className="mt-1 text-[0.78rem] text-[var(--text-2)]">{rule.rationale}</p>
                    )}
                </div>
            </div>

            {rule.trigger && rule.trigger.phrases.length > 0 && (
                <FieldLine label="Trigger">
                    {rule.trigger.phrases.map((p) => (
                        <code key={p} className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.72rem]">{p}</code>
                    ))}
                </FieldLine>
            )}

            <FieldLine label="Expect">
                {rule.expect.tool && <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.72rem]">{labelRuleExpectTool(rule.expect.tool)}</code>}
                {rule.expect.commandMatches?.map((m) => (
                    <code key={m} className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.72rem]">cmd~ {m}</code>
                ))}
                {rule.expect.pattern && <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-[0.72rem]">/{rule.expect.pattern}/</code>}
            </FieldLine>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {onEdit && (
                    <Button size="sm" variant="ghost" onClick={() => onEdit(rule)} disabled={busy}>Edit</Button>
                )}
                {onReEvaluate && (
                    <Button size="sm" variant="ghost" onClick={() => onReEvaluate(rule)} disabled={busy}>Re-evaluate</Button>
                )}
                {onPromote && rule.scope === "task" && (
                    <Button size="sm" variant="ghost" onClick={() => onPromote(rule)} disabled={busy}>Promote to global</Button>
                )}
                {onDelete && (
                    <Button size="sm" variant="destructive" onClick={() => onDelete(rule)} disabled={busy}>Delete</Button>
                )}
            </div>
        </li>
    );
}

function FieldLine({ label, children }: { readonly label: string; readonly children: React.ReactNode }): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.7rem] uppercase tracking-wide text-[var(--text-3)]">{label}</span>
            <div className="flex flex-wrap items-center gap-1">{children}</div>
        </div>
    );
}
