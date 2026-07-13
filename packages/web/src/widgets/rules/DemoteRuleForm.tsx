import { useState } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { Button, Select } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface DemoteRuleFormProps {
  readonly tasks: readonly MonitoringTask[];
  readonly isPending: boolean;
  readonly onSubmit: (taskId: TaskId) => void;
  readonly onCancel: () => void;
}

export function DemoteRuleForm({ tasks, isPending, onSubmit, onCancel }: DemoteRuleFormProps) {
  const [selected, setSelected] = useState<TaskId | "">("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        onSubmit(selected);
      }}
      className="flex flex-col gap-3 py-2"
    >
      <label className="text-xs text-ink-muted flex flex-col gap-1">
        Target task
        <Select value={selected} onChange={(e) => setSelected(e.target.value as TaskId | "")}>
          <option value="">— Select a task —</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {(t.displayTitle ?? t.title).slice(0, 80)}
              {" · "}
              {t.id.slice(0, 8)}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <span className="flex-1" />
        <Button
          type="submit"
          variant="primary"
          disabled={isPending || !selected}
          className={cn((isPending || !selected) && "opacity-50")}
        >
          {isPending ? "Demoting…" : "Demote"}
        </Button>
      </div>
    </form>
  );
}
