import { useEffect, useMemo, useState } from "react";
import { RuleId } from "@monitor/domain";
import { collectRecentRuleDecisions, type MonitoringTask, type RuleDecisionStat, type TaskObservabilitySummary } from "@monitor/web-domain";
import { fetchTaskDetail, fetchTaskObservability, postRuleAction } from "@monitor/web-io";
import { Button } from "./ui/Button.js";
import { Badge } from "./ui/Badge.js";
import { PanelCard } from "./ui/PanelCard.js";
const REVIEWER_ID_STORAGE_KEY = "agent-tracer.reviewer-id";
interface ApprovalQueuePanelProps {
    readonly tasks: readonly MonitoringTask[];
    readonly onClose: () => void;
    readonly onSelectTask: (taskId: string) => void;
    readonly onRefresh: () => Promise<void>;
}
type QueueItem = {
    task: MonitoringTask;
    observability: TaskObservabilitySummary;
};
function queueTone(status: "waiting" | "errored"): "warning" | "danger" {
    return status === "waiting" ? "warning" : "danger";
}
export function ApprovalQueuePanel({ tasks, onClose, onSelectTask, onRefresh }: ApprovalQueuePanelProps): React.JSX.Element {
    const [items, setItems] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actingTaskId, setActingTaskId] = useState<string | null>(null);
    const [notesByTaskId, setNotesByTaskId] = useState<Record<string, string>>({});
    const [reviewerId, setReviewerId] = useState(() => window.localStorage.getItem(REVIEWER_ID_STORAGE_KEY) ?? "local-reviewer");
    const [recentDecisions, setRecentDecisions] = useState<RuleDecisionStat[]>([]);
    const queueTasks = useMemo(() => tasks.filter((task) => task.status === "waiting" || task.status === "errored"), [tasks]);
    useEffect(() => {
        window.localStorage.setItem(REVIEWER_ID_STORAGE_KEY, reviewerId);
    }, [reviewerId]);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const observabilityResponses = await Promise.all(queueTasks.map(async (task) => ({
                    task,
                    observability: (await fetchTaskObservability(task.id)).observability
                })));
                const activeItems = observabilityResponses.filter((item) => item.observability.ruleEnforcement.activeState !== "clear");
                const detailResponses = await Promise.all(activeItems.map(async (item) => ({
                    taskId: item.task.id,
                    timeline: (await fetchTaskDetail(item.task.id)).timeline
                })));
                const timelineByTaskId = new Map(detailResponses.map((item) => [item.taskId, item.timeline]));
                if (!cancelled) {
                    setItems(activeItems.map(({ task, observability }) => ({ task, observability })));
                    setRecentDecisions(activeItems
                        .flatMap((item) => collectRecentRuleDecisions(timelineByTaskId.get(item.task.id) ?? [], 4))
                        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
                        .slice(0, 12));
                }
            }
            catch {
                if (!cancelled) {
                    setItems([]);
                    setRecentDecisions([]);
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [queueTasks]);
    const handleAction = async (item: QueueItem, outcome: "approved" | "rejected" | "bypassed"): Promise<void> => {
        setActingTaskId(item.task.id);
        const reviewerNote = notesByTaskId[item.task.id]?.trim();
        try {
            await postRuleAction({
                taskId: item.task.id,
                action: "review_rule_gate",
                title: outcome === "approved"
                    ? "Approval granted"
                    : outcome === "rejected"
                        ? "Approval rejected"
                        : "Rule bypassed",
                ruleId: item.observability.ruleEnforcement.activeRuleId
                    ?? (item.observability.ruleEnforcement.activeLabel ? RuleId(item.observability.ruleEnforcement.activeLabel) : RuleId("rule-gate")),
                severity: outcome === "approved" ? "info" : "warn",
                status: outcome === "approved" || outcome === "bypassed" ? "pass" : "violation",
                source: "reviewer-queue",
                metadata: {
                    reviewerId,
                    reviewerSource: "approval-queue"
                },
                ...(reviewerNote ? { body: reviewerNote } : {}),
                outcome
            });
            await onRefresh();
            onSelectTask(item.task.id);
        }
        finally {
            setActingTaskId(null);
        }
    };
    return (<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Approval queue">
      <button aria-label="Close approval queue" className="absolute inset-0" onClick={onClose} type="button"/>
      <div className="relative mt-12 w-full max-w-3xl px-2">
        <PanelCard className="max-h-[82vh] overflow-hidden rounded-[14px]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div>
              <h2 className="text-[0.94rem] font-semibold text-[var(--text-1)]">Approval Queue</h2>
              <p className="mt-1 text-[0.76rem] text-[var(--text-3)]">
                Review tasks that are waiting for approval or blocked by rule enforcement.
              </p>
            </div>
            <Button onClick={onClose} size="sm" variant="ghost">Close</Button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            <label className="block">
              <span className="mb-1 block text-[0.72rem] font-semibold text-[var(--text-2)]">Reviewer identity</span>
              <input className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.82rem]" onChange={(event) => setReviewerId(event.target.value)} placeholder="local-reviewer" value={reviewerId}/>
            </label>
            {loading ? (<p className="text-[0.82rem] text-[var(--text-3)]">Loading approval queue…</p>) : items.length === 0 ? (<p className="text-[0.82rem] text-[var(--text-3)]">No tasks currently require approval or bypass review.</p>) : (items.map((item) => (<div key={item.task.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-[0.9rem] text-[var(--text-1)]">{item.task.displayTitle ?? item.task.title}</strong>
                        <Badge size="xs" tone={queueTone(item.task.status as "waiting" | "errored")}>
                          {item.observability.ruleEnforcement.activeState.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[0.78rem] text-[var(--text-3)]">
                        {item.observability.ruleEnforcement.activeLabel
                ? `Rule: ${item.observability.ruleEnforcement.activeLabel}`
                : "Rule guard active"}
                      </p>
                    </div>
                    <Button onClick={() => onSelectTask(item.task.id)} size="sm" variant="ghost">
                      Open Task
                    </Button>
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-[0.72rem] font-semibold text-[var(--text-2)]">Reviewer note</span>
                    <textarea className="min-h-[72px] w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.8rem] leading-6" onChange={(event) => setNotesByTaskId((current) => ({
                ...current,
                [item.task.id]: event.target.value
            }))} placeholder="Optional decision note" value={notesByTaskId[item.task.id] ?? ""}/>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.observability.ruleEnforcement.activeState === "approval_required" && (<>
                        <Button disabled={actingTaskId === item.task.id} onClick={() => void handleAction(item, "approved")} size="sm">
                          Approve
                        </Button>
                        <Button disabled={actingTaskId === item.task.id} onClick={() => void handleAction(item, "rejected")} size="sm" variant="destructive">
                          Reject
                        </Button>
                      </>)}
                    <Button disabled={actingTaskId === item.task.id} onClick={() => void handleAction(item, "bypassed")} size="sm" variant="ghost">
                      Bypass
                    </Button>
                  </div>
                </div>)))}
            {recentDecisions.length > 0 && (<div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <strong className="text-[0.86rem] text-[var(--text-1)]">Audit Log</strong>
                  <Badge tone="neutral" size="xs">{recentDecisions.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {recentDecisions.map((decision) => (<div key={decision.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-[0.8rem] text-[var(--text-1)]">{decision.ruleId}</strong>
                        <Badge size="xs" tone="neutral">{decision.outcome ?? decision.status}</Badge>
                        {decision.reviewerId && <Badge size="xs" tone="accent">{decision.reviewerId}</Badge>}
                      </div>
                      {decision.note && <p className="mt-1 text-[0.76rem] text-[var(--text-3)]">{decision.note}</p>}
                    </div>))}
                </div>
              </div>)}
          </div>
        </PanelCard>
      </div>
    </div>);
}
