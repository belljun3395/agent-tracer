import { useState } from "react";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import type { TaskId } from "~web/shared/identity.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useReEvaluateRuleMutation } from "~web/entities/rule/api/mutations.js";
import { useTaskRulesQuery } from "~web/entities/rule/api/queries.js";
import { useTaskDetailQuery } from "~web/entities/task/api/detail-queries.js";
import { useGuidance, useSelectedTaskId } from "~web/shared/store/index.js";
import { EmptyView } from "~web/shared/ui/index.js";
import { Modal } from "~web/shared/ui/index.js";
import { RuleForm } from "~web/widgets/rules/editor/RuleForm.js";
import { RuleGenerationPanel } from "~web/widgets/rules/generation/RuleGenerationPanel.js";
import { RuleRow } from "~web/widgets/rules/inspector/RuleRow.js";

/** 선택한 태스크의 규칙 목록과 편집 모달을 조율한다. */
export function RulesTab() {
  const guidance = useGuidance();
  const taskId = useSelectedTaskId();
  const rulesQ = useTaskRulesQuery(taskId);
  const detailQ = useTaskDetailQuery(taskId);
  const reEvaluateMutation = useReEvaluateRuleMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);
  const [bulkReEvalPending, setBulkReEvalPending] = useState(false);

  if (!taskId) {
    return <EmptyView eyebrow="Rules" title="Select a task to view its rules." />;
  }
  if (rulesQ.isLoading) {
    return <EmptyView eyebrow="Loading" title="Fetching rules…" />;
  }
  if (rulesQ.isError || !rulesQ.data) {
    return (
      <EmptyView
        eyebrow="Error"
        title="Couldn't load rules"
        description={guidance.messages.rules.loadError}
        locale={guidance.locale}
      />
    );
  }

  const taskRules = rulesQ.data.task;
  const globalRules = rulesQ.data.global;
  const totalRules = taskRules.length + globalRules.length;

  const handleCreate = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };
  const handleEdit = (rule: RuleRecord) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };
  const handleClose = () => {
    setEditorOpen(false);
    setEditingRule(null);
  };
  const handleReEvaluateAll = () => {
    if (bulkReEvalPending || totalRules === 0) return;

    setBulkReEvalPending(true);
    void Promise.allSettled(
      [...taskRules, ...globalRules].map((rule) =>
        reEvaluateMutation.mutateAsync({ ruleId: rule.id, taskId }),
      ),
    ).finally(() => setBulkReEvalPending(false));
  };

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      <RulesTabHeader
        onCreate={handleCreate}
        onReEvaluateAll={handleReEvaluateAll}
        bulkReEvalPending={bulkReEvalPending}
        totalRules={totalRules}
      />

      <RuleGenerationPanel
        taskId={taskId}
        taskStatus={detailQ.data?.task.status ?? null}
      />

      {totalRules === 0 ? (
        <EmptyView
          eyebrow="Empty"
          title="No rules configured"
          description={guidance.messages.rules.emptyTask}
          locale={guidance.locale}
        />
      ) : (
        <>
          <RuleSection
            title="Task-scoped"
            rules={taskRules}
            contextTaskId={taskId}
            emptyHint="No rules attached to this task."
            onEdit={handleEdit}
          />
          <RuleSection
            title="Global"
            rules={globalRules}
            contextTaskId={taskId}
            emptyHint="No global rules."
            onEdit={handleEdit}
          />
        </>
      )}

      <Modal
        open={editorOpen}
        onClose={handleClose}
        title={editingRule ? "Edit rule" : "New rule"}
        description={
          editingRule
            ? guidance.messages.rules.editDescription
            : guidance.messages.rules.newTaskDescription
        }
        descriptionLocale={guidance.locale}
      >
        <RuleForm
          {...(editingRule ? { rule: editingRule } : {})}
          defaultTaskId={taskId}
          defaultScope={editingRule?.scope ?? "task"}
          onClose={handleClose}
        />
      </Modal>
    </div>
  );
}

interface RulesTabHeaderProps {
  readonly onCreate: () => void;
  readonly onReEvaluateAll: () => void;
  readonly bulkReEvalPending: boolean;
  readonly totalRules: number;
}

function RulesTabHeader({
  onCreate,
  onReEvaluateAll,
  bulkReEvalPending,
  totalRules,
}: RulesTabHeaderProps) {
  const reEvaluateDisabled = totalRules === 0 || bulkReEvalPending;
  return (
    <div className="flex items-center justify-between">
      <h3 className="m-0 text-[13px] font-semibold text-ink tracking-[-0.1px]">
        Rules
      </h3>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReEvaluateAll}
          disabled={reEvaluateDisabled}
          title={
            totalRules === 0
              ? "No rules to re-evaluate"
              : bulkReEvalPending
                ? "Re-evaluating all rules…"
                : "Re-evaluate every rule against this task"
          }
          className={cn(
            "inline-flex items-center gap-1 py-1.5 px-2.5 text-xs font-medium border border-hair rounded-xs whitespace-nowrap",
            reEvaluateDisabled
              ? "text-ink-tertiary bg-s1 cursor-not-allowed"
              : "text-ink bg-s2 cursor-pointer",
          )}
        >
          {bulkReEvalPending
            ? "Re-evaluating…"
            : `↻ Re-eval all${totalRules > 0 ? ` (${totalRules})` : ""}`}
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 py-1.5 px-2.5 text-xs font-medium text-ink bg-s2 border border-hair rounded-xs cursor-pointer"
        >
          + Rule
        </button>
      </div>
    </div>
  );
}

interface RuleSectionProps {
  readonly title: string;
  readonly rules: readonly RuleRecord[];
  readonly contextTaskId: TaskId | null;
  readonly emptyHint: string;
  readonly onEdit: (rule: RuleRecord) => void;
}

function RuleSection({
  title,
  rules,
  contextTaskId,
  emptyHint,
  onEdit,
}: RuleSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
        <span>{title}</span>
        <span className="text-ink-muted">{rules.length}</span>
      </div>
      {rules.length === 0 ? (
        <p className="m-0 text-xs text-ink-subtle pl-0.5">{emptyHint}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              contextTaskId={contextTaskId}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
