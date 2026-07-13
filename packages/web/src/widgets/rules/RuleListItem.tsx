import { useState } from "react";
import { expectationTool } from "@monitor/kernel";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { RULE_EXPECTATION_KIND, needsReview, type RuleRecord } from "~web/entities/rule/model/rule.js";
import { RuleSeverityChip } from "~web/widgets/rules/presentation/RuleSeverityChip.js";
import {
  useApproveRuleMutation,
  useDeleteRuleMutation,
  useDemoteRuleMutation,
  usePromoteRuleMutation,
} from "~web/entities/rule/api/mutations.js";
import { Button, Modal } from "~web/shared/ui/index.js";
import { useGuidance } from "~web/shared/store/index.js";
import { useConfirmAction } from "~web/shared/lib/hooks/use-confirm-action.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { RuleTaskBreadcrumb } from "~web/widgets/rules/RuleTaskBreadcrumb.js";
import { DemoteRuleForm } from "~web/widgets/rules/DemoteRuleForm.js";

interface RuleListItemProps {
  readonly rule: RuleRecord;
  readonly onEdit: (rule: RuleRecord) => void;
  readonly task: MonitoringTask | null;
  readonly tasks: readonly MonitoringTask[];
}

export function RuleListItem({ rule, onEdit, task, tasks }: RuleListItemProps) {
  const guidance = useGuidance();
  const promoteMutation = usePromoteRuleMutation();
  const demoteMutation = useDemoteRuleMutation();
  const deleteMutation = useDeleteRuleMutation();
  const approveMutation = useApproveRuleMutation();
  const [demoteOpen, setDemoteOpen] = useState(false);
  const awaitingReview = needsReview(rule);
  const isPending =
    promoteMutation.isPending
    || demoteMutation.isPending
    || deleteMutation.isPending
    || approveMutation.isPending;

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
        <span className="font-mono text-[10.5px] text-ink-tertiary py-0.5 px-1.5 bg-s2 rounded-[2px] uppercase tracking-[0.06em]">
          {rule.scope}
        </span>
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
        {rule.trigger?.phrases.length && (
          <>
            <span className="text-hair-strong">·</span>
            <span>
              {rule.trigger.phrases.length} trigger phrase
              {rule.trigger.phrases.length === 1 ? "" : "s"}
            </span>
          </>
        )}
        {rule.scope === "task" && rule.taskId && (
          <>
            <span className="text-hair-strong">·</span>
            <RuleTaskBreadcrumb taskId={rule.taskId} task={task} />
          </>
        )}
      </div>

      {rule.rationale && (
        <p className="m-0 text-xs text-ink-subtle leading-[1.5]">{rule.rationale}</p>
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
        {rule.scope === "task" && (
          <Button variant="ghost" onClick={() => promoteMutation.mutate(rule.id)} disabled={isPending}>
            Promote to global
          </Button>
        )}
        {rule.scope === "global" && (
          <Button variant="ghost" onClick={() => setDemoteOpen(true)} disabled={isPending}>
            Demote to task…
          </Button>
        )}
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

      <Modal
        open={demoteOpen}
        onClose={() => setDemoteOpen(false)}
        title="Demote rule to a task"
        description={guidance.messages.rules.demoteDescription}
        descriptionLocale={guidance.locale}
      >
        <DemoteRuleForm
          tasks={tasks}
          isPending={demoteMutation.isPending}
          onCancel={() => setDemoteOpen(false)}
          onSubmit={(taskId) => {
            demoteMutation.mutate(
              { ruleId: rule.id, taskId },
              { onSuccess: () => setDemoteOpen(false) },
            );
          }}
        />
      </Modal>
    </article>
  );
}
