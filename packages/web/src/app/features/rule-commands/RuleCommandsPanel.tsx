import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TaskId } from "../../../types.js";
import type { RuleCommandRecord } from "../../../types.js";
import { createGlobalRuleCommand, createTaskRuleCommand, deleteRuleCommandById } from "../../../io.js";
import { monitorQueryKeys } from "../../../state.js";
import { useGlobalRuleCommandsQuery, useTaskRuleCommandsQuery } from "../../../state.js";

interface RuleCommandsPanelProps {
  readonly taskId?: TaskId;
}

export function RuleCommandsPanel({ taskId }: RuleCommandsPanelProps) {
  const queryClient = useQueryClient();
  const globalQuery = useGlobalRuleCommandsQuery();
  const taskQuery = useTaskRuleCommandsQuery(taskId ?? null);
  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [scope, setScope] = useState<"global" | "task">(taskId ? "task" : "global");

  const globalRules = globalQuery.data?.ruleCommands ?? [];
  const taskRules = taskQuery.data?.ruleCommands ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.ruleCommands() });
    if (taskId) {
      void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.ruleCommands(taskId) });
    }
  };

  const handleAdd = async () => {
    if (!pattern.trim() || !label.trim()) return;
    setIsAdding(true);
    try {
      if (scope === "task" && taskId) {
        await createTaskRuleCommand(taskId, pattern.trim(), label.trim());
      } else {
        await createGlobalRuleCommand(pattern.trim(), label.trim());
      }
      setPattern("");
      setLabel("");
      invalidate();
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRuleCommandById(id);
    invalidate();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.78rem] font-semibold text-[var(--text-1)]">Rule Commands</h3>
        <p className="text-[0.72rem] text-[var(--text-3)]">
          Commands matching these patterns will appear in the Rule lane.
        </p>
      </div>

      {/* Global rules */}
      <div className="flex flex-col gap-2">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
          Global
        </span>
        {globalRules.length === 0 && (
          <p className="text-[0.72rem] text-[var(--text-3)]">No global rules yet.</p>
        )}
        {globalRules.map((rule) => (
          <RuleCommandRow key={rule.id} rule={rule} onDelete={handleDelete} />
        ))}
      </div>

      {/* Task rules */}
      {taskId && (
        <div className="flex flex-col gap-2">
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
            This Task
          </span>
          {taskRules.length === 0 && (
            <p className="text-[0.72rem] text-[var(--text-3)]">No task-specific rules yet.</p>
          )}
          {taskRules.map((rule) => (
            <RuleCommandRow key={rule.id} rule={rule} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Add new rule */}
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">
          Add Rule
        </span>
        {taskId && (
          <div className="flex gap-2">
            <button
              className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-[0.68rem] font-semibold transition ${scope === "global" ? "bg-[var(--rule-bg)] text-[var(--rule)]" : "text-[var(--text-3)] hover:bg-[var(--surface-2)]"}`}
              onClick={() => setScope("global")}
              type="button"
            >
              Global
            </button>
            <button
              className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-[0.68rem] font-semibold transition ${scope === "task" ? "bg-[var(--rule-bg)] text-[var(--rule)]" : "text-[var(--text-3)] hover:bg-[var(--surface-2)]"}`}
              onClick={() => setScope("task")}
              type="button"
            >
              This Task
            </button>
          </div>
        )}
        <input
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--rule)] focus:ring-1 focus:ring-[var(--rule)]"
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Pattern (e.g. npm run lint)"
          type="text"
          value={pattern}
        />
        <input
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.78rem] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--rule)] focus:ring-1 focus:ring-[var(--rule)]"
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Lint check)"
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
          type="text"
          value={label}
        />
        <button
          className="self-start rounded-[var(--radius-sm)] bg-[var(--rule)] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={isAdding || !pattern.trim() || !label.trim()}
          onClick={() => void handleAdd()}
          type="button"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function RuleCommandRow({ rule, onDelete }: { rule: RuleCommandRecord; onDelete: (id: string) => void | Promise<void> }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--rule-border)] bg-[var(--rule-bg)] px-2.5 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="truncate text-[0.75rem] font-semibold text-[var(--rule)]">{rule.label}</span>
        <code className="truncate text-[0.68rem] text-[var(--text-2)]">{rule.pattern}</code>
      </div>
      <button
        className="shrink-0 text-[var(--text-3)] hover:text-[var(--err)] transition"
        onClick={() => { void onDelete(rule.id); }}
        type="button"
        aria-label="Delete rule"
      >
        <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}
