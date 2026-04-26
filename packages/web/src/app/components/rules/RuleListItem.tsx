import type React from "react";
import { useMemo } from "react";
import type { RuleRecord } from "../../../types.js";

export interface RuleListItemProps {
    readonly rule: RuleRecord;
    readonly actions: React.ReactNode;
}

export function RuleListItem({ rule, actions }: RuleListItemProps): React.JSX.Element {
    const expectSummary = useMemo(() => {
        const parts: string[] = [];
        if (rule.expect.tool) parts.push(rule.expect.tool);
        if (rule.expect.commandMatches?.length) parts.push(rule.expect.commandMatches.join("|"));
        if (rule.expect.pattern) parts.push(rule.expect.pattern);
        return parts.length > 0 ? parts.join(" ") : "(no expectation)";
    }, [rule]);

    return (
        <div
            className="mb-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-1)]"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.84rem] font-semibold text-[var(--text-1)]">{rule.name}</span>
                        <span className="rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-[0.64rem] font-semibold uppercase text-[var(--text-3)]">
                            {rule.source}
                        </span>
                        <span className="rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-[0.64rem] font-semibold uppercase text-[var(--text-3)]">
                            {rule.scope === "global" ? "global" : `task: ${rule.taskId ?? "?"}`}
                        </span>
                        <span className="rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-[0.64rem] font-semibold uppercase text-[var(--text-3)]">
                            {rule.severity}
                        </span>
                        {rule.trigger && (
                            <span className="rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 py-0.5 text-[0.64rem] font-semibold uppercase text-[var(--text-3)]">
                                on: {rule.triggerOn ?? "assistant"}
                            </span>
                        )}
                    </div>
                    {rule.rationale && (
                        <div className="mt-0.5 text-[0.72rem] text-[var(--text-3)]">{rule.rationale}</div>
                    )}
                    <div className="mt-2 text-[0.7rem] text-[var(--text-2)]">
                        {rule.trigger ? (
                            <>
                                <span className="font-mono">{rule.trigger.phrases.join(" | ")}</span>
                                <span className="mx-2">→</span>
                            </>
                        ) : (
                            <span className="font-mono text-[var(--text-3)]">(no trigger) </span>
                        )}
                        <span className="font-mono text-[var(--text-3)]">{expectSummary}</span>
                    </div>
                </div>
                <div className="flex shrink-0 gap-1.5">{actions}</div>
            </div>
        </div>
    );
}

export interface RuleEmptyStateProps {
    readonly heading: string;
    readonly description: string;
}

export function RuleEmptyState({ heading, description }: RuleEmptyStateProps): React.JSX.Element {
    return (
        <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_72%,var(--surface))] text-[var(--text-3)]">
                <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
            </div>
            <p className="m-0 text-[0.9rem] font-semibold text-[var(--text-1)]">{heading}</p>
            <p className="m-0 mt-1 max-w-[24rem] text-[0.78rem] leading-6 text-[var(--text-3)]">{description}</p>
        </div>
    );
}
