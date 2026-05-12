import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RuleRecord } from "~domain/rule.js";
import type { TaskId } from "~domain/monitoring.js";
import {
  useAppSettingsQuery,
  useLatestGenerateRulesJobQuery,
  useTaskDetailQuery,
  useTaskRulesQuery,
} from "~state/server/queries.js";
import {
  useEnqueueGenerateRulesMutation,
  useReEvaluateRuleMutation,
} from "~state/server/mutations.js";
import { useSelectedTaskId } from "~state/ui/index.js";
import { EmptyView } from "~features/shell/index.js";
import { Modal } from "~ui/index.js";
import { monitorQueryKeys } from "~state/server/queryKeys.js";
import { countRuleMatches } from "./lib/rule-matches.js";
import { RuleRow } from "./RuleRow.js";
import { RuleForm } from "./RuleForm.js";

const API_KEY_SETTING = "anthropic.api_key";

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
  const reEvalMutation = useReEvaluateRuleMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);
  const [bulkReEvalPending, setBulkReEvalPending] = useState(false);

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
  const handleReEvalAll = () => {
    if (bulkReEvalPending || totalRules === 0) return;
    setBulkReEvalPending(true);
    void Promise.allSettled(
      [...taskRules, ...globalRules].map((rule) =>
        reEvalMutation.mutateAsync({
          ruleId: rule.id,
          ...(taskId ? { taskId } : {}),
        }),
      ),
    ).finally(() => setBulkReEvalPending(false));
  };

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      <Header
        onCreate={handleCreate}
        onReEvalAll={handleReEvalAll}
        bulkReEvalPending={bulkReEvalPending}
        totalRules={totalRules}
      />

      <GenerateRulesPanel
        taskId={taskId}
        taskStatus={detailQ.data?.task.status ?? null}
      />

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

interface GenerateRulesPanelProps {
  readonly taskId: TaskId;
  readonly taskStatus: string | null;
}

function GenerateRulesPanel({ taskId, taskStatus }: GenerateRulesPanelProps) {
  const queryClient = useQueryClient();
  const settingsQ = useAppSettingsQuery();
  const jobQ = useLatestGenerateRulesJobQuery(taskId);
  const enqueueMutation = useEnqueueGenerateRulesMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiKeyConfigured = useMemo(() => {
    return (settingsQ.data?.settings ?? []).some((s) => s.key === API_KEY_SETTING);
  }, [settingsQ.data]);

  const isTaskCompleted = taskStatus === "completed";
  const settingsLoaded = !settingsQ.isLoading;
  const job = jobQ.data?.job ?? null;
  const isInFlight = job?.status === "pending" || job?.status === "processing";

  useEffect(() => {
    if (job?.status === "completed" && job.rulesCreated > 0) {
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.taskRules(taskId),
      });
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
    }
  }, [job?.status, job?.rulesCreated, queryClient, taskId]);

  const onGenerate = async () => {
    setErrorMessage(null);
    try {
      await enqueueMutation.mutateAsync(taskId);
      void jobQ.refetch();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  // Button is disabled only when we know API key is missing or generation is
  // already running. Task status is informational — generation works on
  // in-progress tasks too, but the timeline may be incomplete (we surface
  // that as a warning, not a hard block).
  const disabled = !settingsLoaded || !apiKeyConfigured || isInFlight;
  const blockingReason = !settingsLoaded
    ? "Loading settings…"
    : !apiKeyConfigured
      ? "Configure an Anthropic API key in Settings to enable."
      : isInFlight
        ? "Generation already in progress."
        : null;
  const warningReason =
    !blockingReason && !isTaskCompleted
      ? `Task status is "${taskStatus ?? "unknown"}" — the timeline may be incomplete.`
      : null;

  return (
    <div
      style={{
        border: "1px dashed var(--hair)",
        borderRadius: "var(--radius-sm)",
        padding: "12px",
        background: "var(--s1)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--ink-tertiary)",
              margin: 0,
            }}
          >
            Auto-generate
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--ink-muted)",
              lineHeight: 1.4,
            }}
          >
            Run a Claude Agent SDK pass over this task's workspace and timeline
            to propose verification rules. Generated rules are saved as
            <code style={{ margin: "0 4px" }}>source=agent</code>
            with
            <code style={{ margin: "0 4px" }}>severity=info</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={disabled}
          title={blockingReason ?? (warningReason ?? "")}
          style={{
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 500,
            color: disabled ? "var(--ink-tertiary)" : "var(--canvas)",
            background: disabled ? "var(--s2)" : "var(--ink)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-xs)",
            cursor: disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isInFlight ? "Generating…" : "Generate rules"}
        </button>
      </div>
      {blockingReason && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "var(--ink-tertiary)",
          }}
        >
          {blockingReason}
          {!apiKeyConfigured && settingsLoaded && (
            <>
              {" "}
              <a
                href="/settings"
                style={{ color: "var(--ink-muted)", textDecoration: "underline" }}
              >
                Open Settings →
              </a>
            </>
          )}
        </p>
      )}
      {warningReason && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "var(--warn, #b58900)",
          }}
        >
          ⚠ {warningReason}
        </p>
      )}
      {job && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color:
              job.status === "failed"
                ? "var(--danger, #ff8585)"
                : "var(--ink-tertiary)",
          }}
        >
          Last run: {job.status}
          {job.status === "completed" &&
            ` · ${job.rulesCreated} rules created (${
              job.modelUsed ?? "model unknown"
            }, ${
              job.durationMs != null ? `${Math.round(job.durationMs / 100) / 10}s` : "n/a"
            })`}
          {job.status === "failed" && job.error && ` · ${job.error}`}
        </p>
      )}
      {errorMessage && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "var(--danger, #ff8585)",
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

interface HeaderProps {
  readonly onCreate: () => void;
  readonly onReEvalAll: () => void;
  readonly bulkReEvalPending: boolean;
  readonly totalRules: number;
}

function Header({
  onCreate,
  onReEvalAll,
  bulkReEvalPending,
  totalRules,
}: HeaderProps) {
  const reEvalDisabled = totalRules === 0 || bulkReEvalPending;
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReEvalAll}
          disabled={reEvalDisabled}
          title={
            totalRules === 0
              ? "No rules to re-evaluate"
              : bulkReEvalPending
                ? "Re-evaluating all rules…"
                : "Re-evaluate every rule against this task"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 500,
            color: reEvalDisabled ? "var(--ink-tertiary)" : "var(--ink)",
            background: reEvalDisabled ? "var(--s1)" : "var(--s2)",
            border: "1px solid var(--hair)",
            borderRadius: "var(--radius-xs)",
            cursor: reEvalDisabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {bulkReEvalPending
            ? "Re-evaluating…"
            : `↻ Re-eval all${totalRules > 0 ? ` (${totalRules})` : ""}`}
        </button>
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
