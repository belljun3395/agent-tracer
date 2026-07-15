import { expectationTool } from "@monitor/kernel";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { RULE_EXPECTATION_KIND, needsReview, type RuleRecord } from "~web/entities/rule/model/rule.js";
import { RuleSeverityChip } from "~web/widgets/rules/presentation/RuleSeverityChip.js";
import {
  useApproveRuleMutation,
  useDeleteRuleMutation,
} from "~web/entities/rule/api/mutations.js";
import { Button } from "~web/shared/ui/index.js";
import { useConfirmAction } from "~web/shared/lib/hooks/use-confirm-action.js";
import { useSetSelectedEventId } from "~web/shared/store/index.js";
import { EventId } from "~web/shared/identity.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { RuleTaskBreadcrumb } from "~web/widgets/rules/RuleTaskBreadcrumb.js";

interface RuleListItemProps {
  readonly rule: RuleRecord;
  readonly onEdit: (rule: RuleRecord) => void;
  readonly task: MonitoringTask | null;
}

export function RuleListItem({ rule, onEdit, task }: RuleListItemProps) {
  const deleteMutation = useDeleteRuleMutation();
  const approveMutation = useApproveRuleMutation();
  const setSelectedEventId = useSetSelectedEventId();
  const awaitingReview = needsReview(rule);
  const isPending = deleteMutation.isPending || approveMutation.isPending;
  const hasCitations = rule.citedTurnIds.length > 0 || rule.citedEventIds.length > 0;

  const confirmDelete = useConfirmAction(() => deleteMutation.mutate(rule.id));

  return (
    <article
      className={cn(
        "bg-s1 border border-hair rounded-md py-3 px-3.5 flex flex-col gap-2",
        isPending && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <RuleSeverityChip severity={rule.severity} />
        <span className="text-[13px] font-medium text-ink tracking-[-0.05px] flex-1 min-w-0">
          {rule.name}
        </span>
        {awaitingReview && (
          <span className="font-mono text-[10.5px] text-warn py-0.5 px-1.5 bg-s2 rounded-[2px] uppercase tracking-[0.06em]">
            Pending review
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap font-mono text-[10.5px] text-ink-tertiary">
        <span>source · {rule.source}</span>
        {expectationTool(rule.expect) && (
          <>
            <span className="text-hair-strong">·</span>
            <span>tool · {expectationTool(rule.expect)}</span>
          </>
        )}
        {rule.expect.kind === RULE_EXPECTATION_KIND.pattern && (
          <>
            <span className="text-hair-strong">·</span>
            <span title={rule.expect.pattern}>pattern</span>
          </>
        )}
        <span className="text-hair-strong">·</span>
        <RuleTaskBreadcrumb taskId={rule.taskId} task={task} />
      </div>

      {rule.rationale && (
        <p className="m-0 text-xs text-ink-subtle leading-[1.5]">{rule.rationale}</p>
      )}

      {awaitingReview && hasCitations && (
        <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-dashed border-hair">
          {rule.citedTurnIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10.5px] text-ink-tertiary">
              <span className="uppercase tracking-[0.06em]">Cited turns</span>
              {rule.citedTurnIds.map((turnId) => (
                <span key={turnId} className="text-ink-subtle">
                  {turnId}
                </span>
              ))}
            </div>
          )}
          {rule.citedEventIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10.5px] text-ink-tertiary">
              <span className="uppercase tracking-[0.06em]">Cited events</span>
              {rule.citedEventIds.map((eventId) => (
                <button
                  key={eventId}
                  type="button"
                  onClick={() => setSelectedEventId(EventId(eventId))}
                  className="text-primary-hover bg-primary/12 py-0.5 px-1.5 rounded-xs cursor-pointer hover:bg-primary/20"
                >
                  {eventId}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        {awaitingReview && (
          <Button variant="ghost" onClick={() => approveMutation.mutate(rule.id)} disabled={isPending}>
            Approve
          </Button>
        )}
        <Button variant="ghost" onClick={() => onEdit(rule)} disabled={isPending}>
          Edit
        </Button>
        <span className="flex-1" />
        <Button
          variant="ghost"
          onClick={confirmDelete.trigger}
          disabled={isPending}
          className={cn(
            confirmDelete.armed || deleteMutation.isError
              ? "text-err border-err"
              : "text-ink-muted border-hair",
            confirmDelete.armed && "bg-err/14",
          )}
        >
          {confirmDelete.armed
            ? "Click again to confirm"
            : deleteMutation.isError
              ? "Retry delete"
              : "Delete"}
        </Button>
      </div>
    </article>
  );
}
