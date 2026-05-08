import { useMemo, useState } from "react";
import type { RuleRecord } from "~domain/rule.js";
import type { TaskId } from "~domain/monitoring.js";
import {
  useTaskDetailQuery,
  useTaskRulesQuery,
} from "~state/server/queries.js";
import { useSelectedTaskId } from "~state/ui/index.js";
import { EmptyView } from "~features/shell/index.js";
import { Modal } from "~ui/index.js";
import { countRuleMatches } from "./lib/rule-matches.js";
import { RuleRow } from "./RuleRow.js";
import { RuleForm } from "./RuleForm.js";

/**
 * Rules tab — split into two sections:
 *
 *   • TASK-SCOPED — rules attached specifically to this task
 *   • GLOBAL      — rules that apply to every task
 *
 * Each row shows how many times the rule fired against this task's
 * timeline (count derived from event.classification.matches), so
 * dormant rules are obviously distinguishable from active ones.
 */
export function RulesTab() {
  const taskId = useSelectedTaskId();
  const rulesQ = useTaskRulesQuery(taskId);
  const detailQ = useTaskDetailQuery(taskId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);

  const matchCounts = useMemo(() => {
    if (!detailQ.data) return {};
    return countRuleMatches(detailQ.data.timeline);
  }, [detailQ.data]);

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
        description="Check the monitor server connection."
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

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      <Header onCreate={handleCreate} />

      {totalRules === 0 ? (
        <EmptyView
          eyebrow="Empty"
          title="No rules configured"
          description="Add a rule to start enforcing checks against this task."
        />
      ) : (
        <>
          <Section
            title="Task-scoped"
            rules={taskRules}
            counts={matchCounts}
            contextTaskId={taskId}
            emptyHint="No rules attached to this task."
            onEdit={handleEdit}
          />
          <Section
            title="Global"
            rules={globalRules}
            counts={matchCounts}
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
            ? "Update the rule's expectation, severity, or rationale."
            : "Define a new check that runs against this task's events."
        }
      >
        <RuleForm
          {...(editingRule ? { rule: editingRule } : {})}
          {...(taskId ? { defaultTaskId: taskId } : {})}
          defaultScope={editingRule?.scope ?? "task"}
          onClose={handleClose}
        />
      </Modal>
    </div>
  );
}

function Header({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.1px",
        }}
      >
        Rules
      </h3>
      <button
        type="button"
        onClick={onCreate}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--ink)",
          background: "var(--s2)",
          border: "1px solid var(--hair)",
          borderRadius: "var(--radius-xs)",
          cursor: "pointer",
        }}
      >
        + Rule
      </button>
    </div>
  );
}

interface SectionProps {
  readonly title: string;
  readonly rules: readonly RuleRecord[];
  readonly counts: Readonly<Record<string, number>>;
  readonly contextTaskId: TaskId | null;
  readonly emptyHint: string;
  readonly onEdit: (rule: RuleRecord) => void;
}

function Section({ title, rules, counts, contextTaskId, emptyHint, onEdit }: SectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>{title}</span>
        <span style={{ color: "var(--ink-muted)" }}>{rules.length}</span>
      </div>
      {rules.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--ink-subtle)",
            paddingLeft: 2,
          }}
        >
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              matchCount={counts[rule.id] ?? 0}
              contextTaskId={contextTaskId}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
