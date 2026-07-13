import { useMemo, useState } from "react";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import type { RuleRecord } from "~web/entities/rule/model/rule.js";
import { useRulesQuery } from "~web/entities/rule/api/queries.js";
import { useTasksQuery } from "~web/entities/task/api/list-queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText, Modal } from "~web/shared/ui/index.js";
import { RuleForm } from "~web/widgets/rules/editor/RuleForm.js";
import { RuleFilterBar, type ScopeFilter, type SeverityFilter } from "~web/widgets/rules/RuleFilterBar.js";
import { RuleListItem } from "~web/widgets/rules/RuleListItem.js";

/** `/rules`. 워크스페이스 전체 규칙 관리 화면이다. */
export function RulesPage() {
  const guidance = useGuidance();
  const { data, isLoading, isError } = useRulesQuery();
  const tasksQ = useTasksQuery();
  const taskById = useMemo(() => {
    const m = new Map<TaskId, MonitoringTask>();
    for (const t of tasksQ.data?.tasks ?? []) m.set(t.id, t);
    return m;
  }, [tasksQ.data]);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRecord | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rules.filter((rule) => {
      if (scope !== "all" && rule.scope !== scope) return false;
      if (severity !== "all" && rule.severity !== severity) return false;
      if (q && !rule.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, scope, severity, search]);

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
    <div className="flex flex-col min-h-0 h-full overflow-auto">
      <header className="px-9 pt-6 pb-4 flex flex-col gap-3 border-b border-hair">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
              Workspace
            </p>
            <h1 className="mt-0.5 mb-0 text-[22px] font-semibold text-ink tracking-[-0.3px]">
              Rules
            </h1>
            <GuidanceText
              as="p"
              className="mt-1 mb-0 text-[12.5px] text-ink-subtle"
              locale={guidance.locale}
              message={guidance.messages.rules.workspaceIntroduction}
            />
            <p className="mt-1 mb-0 text-[12.5px] text-ink-subtle">
              {isLoading
                ? "Loading…"
                : data
                  ? `${data.rules.length} rule${data.rules.length === 1 ? "" : "s"} configured`
                  : "Couldn't load rules."}
            </p>
          </div>
          <Button variant="primary" onClick={handleCreate}>
            + New rule
          </Button>
        </div>

        <RuleFilterBar
          scope={scope}
          onScopeChange={setScope}
          severity={severity}
          onSeverityChange={setSeverity}
          search={search}
          onSearchChange={setSearch}
        />
      </header>

      <div className="px-9 py-6 flex flex-col gap-2.5">
        {isError && (
          <div className="text-err text-[12.5px]">
            <p className="m-0">Couldn't load rules.</p>
            <GuidanceText
              as="p"
              className="mt-1 mb-0"
              locale={guidance.locale}
              message={guidance.messages.rules.loadError}
            />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          data && data.rules.length === 0 ? (
            <GuidanceText
              as="p"
              className="text-[12.5px] text-ink-subtle text-center py-8"
              locale={guidance.locale}
              message={guidance.messages.rules.workspaceEmpty}
            />
          ) : (
            <p className="text-[12.5px] text-ink-subtle text-center py-8">
              No rules match the current filters.
            </p>
          )
        )}
        {filtered.map((rule) => (
          <RuleListItem
            key={rule.id}
            rule={rule}
            onEdit={handleEdit}
            task={rule.taskId ? taskById.get(rule.taskId) ?? null : null}
            tasks={tasksQ.data?.tasks ?? []}
          />
        ))}
      </div>

      <Modal
        open={editorOpen}
        onClose={handleClose}
        title={editingRule ? "Edit rule" : "New rule"}
        description={
          editingRule
            ? guidance.messages.rules.editDescription
            : guidance.messages.rules.newWorkspaceDescription
        }
        descriptionLocale={guidance.locale}
      >
        <RuleForm
          {...(editingRule ? { rule: editingRule } : {})}
          defaultScope={editingRule?.scope ?? "global"}
          onClose={handleClose}
        />
      </Modal>
    </div>
  );
}
