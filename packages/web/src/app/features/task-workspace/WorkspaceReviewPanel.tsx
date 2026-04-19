import type React from "react";
import { Button } from "../../components/ui/Button.js";
import type { WorkspaceState } from "./useWorkspace.js";

interface WorkspaceReviewPanelProps {
    readonly workspace: Pick<WorkspaceState, "taskObservability" | "recentRuleDecisions" | "handleRuleReview">;
    readonly reviewerNote: string;
    readonly reviewerId: string;
    readonly isSubmittingRuleReview: boolean;
    readonly onReviewerNoteChange: (note: string) => void;
    readonly onReviewerIdChange: (id: string) => void;
}

export function WorkspaceReviewPanel({
    workspace,
    reviewerNote,
    reviewerId,
    isSubmittingRuleReview,
    onReviewerNoteChange,
    onReviewerIdChange,
}: WorkspaceReviewPanelProps): React.JSX.Element | null {
    const { taskObservability, recentRuleDecisions, handleRuleReview } = workspace;
    const ruleState = taskObservability?.observability.ruleEnforcement.activeState;

    if (ruleState !== "approval_required" && ruleState !== "blocked") return null;

    return (
        <section className="mb-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-1)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Review decision</p>
                    <p className="mt-1 text-[0.84rem] text-[var(--text-2)]">
                        {taskObservability?.observability.ruleEnforcement.activeLabel
                            ? `Active rule: ${taskObservability.observability.ruleEnforcement.activeLabel}`
                            : "A rule guard is currently active for this task."}
                    </p>
                </div>
                <div className="flex gap-2">
                    {ruleState === "approval_required" && (
                        <Button size="sm" variant="accent" disabled={isSubmittingRuleReview}
                            onClick={() => void handleRuleReview("approved", reviewerId, reviewerNote)}>Approve</Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={isSubmittingRuleReview}
                        onClick={() => void handleRuleReview("rejected", reviewerId, reviewerNote)}>Reject</Button>
                    <Button size="sm" disabled={isSubmittingRuleReview}
                        onClick={() => void handleRuleReview("bypassed", reviewerId, reviewerNote)}>Bypass</Button>
                </div>
            </div>
            <textarea
                className="mt-3 min-h-[78px] w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.82rem] leading-6"
                onChange={(e) => onReviewerNoteChange(e.target.value)}
                placeholder="Optional reviewer note"
                value={reviewerNote}
            />
            <input
                className="mt-3 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.82rem]"
                onChange={(e) => onReviewerIdChange(e.target.value)}
                placeholder="Reviewer identity"
                value={reviewerId}
            />
            {recentRuleDecisions.length > 0 && (
                <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                    <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Recent decisions</p>
                    <div className="mt-2 flex flex-col gap-2">
                        {recentRuleDecisions.slice(0, 3).map((decision) => (
                            <div key={decision.id} className="text-[0.78rem] text-[var(--text-2)]">
                                <strong className="text-[var(--text-1)]">{decision.ruleId}</strong>
                                {" · "}{decision.outcome ?? decision.status}
                                {decision.reviewerId ? ` · ${decision.reviewerId}` : ""}
                                {decision.note ? ` — ${decision.note}` : ""}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
