import type React from "react";
import { buildInspectorEventTitle, type TodoGroup } from "../../../types.js";
import { Badge } from "../ui/Badge.js";
import { inspectorHelpText } from "./helpText.js";
import { SectionCard } from "./SectionCard.js";
const TODO_STATE_LABELS: Readonly<Record<string, string>> = {
    added: "Added",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled"
};
export function TodoGroupSection({ group }: {
    readonly group: TodoGroup;
}): React.JSX.Element {
    return (<SectionCard title="Todo Lifecycle" helpText={inspectorHelpText.todoLifecycle} bodyClassName="pt-4">
      <div className="flex flex-col gap-2">
        {group.transitions.map(({ state, event }) => (<div key={event.id} className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Badge tone={state === "completed" ? "success" : state === "added" ? "accent" : state === "cancelled" ? "danger" : "warning"} size="xs">
              {TODO_STATE_LABELS[state] ?? state}
            </Badge>
            <span className="min-w-0 flex-1 text-[0.84rem] font-medium text-[var(--text-1)]">{buildInspectorEventTitle(event) ?? event.title}</span>
            <span className="text-[0.76rem] font-semibold text-[var(--text-3)]">{new Date(event.createdAt).toLocaleTimeString()}</span>
          </div>))}
      </div>
      <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
        Current: <strong className="text-[var(--text-2)]">{TODO_STATE_LABELS[group.currentState] ?? group.currentState}</strong>
        {group.isTerminal ? " (terminal)" : ""}
      </p>
    </SectionCard>);
}
