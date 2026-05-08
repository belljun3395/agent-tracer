import { useMemo, useState } from "react";
import type { RuleRecord, RuleScope, RuleSeverity } from "~domain/rule.js";
import { useRulesQuery } from "~state/server/queries.js";
import { Modal } from "~ui/index.js";
import { RuleForm } from "~features/inspector/tabs/rules/RuleForm.js";
import { RuleSeverityChip } from "~features/inspector/tabs/rules/RuleSeverityChip.js";
import {
  useDeleteRuleMutation,
  usePromoteRuleMutation,
} from "~state/server/mutations.js";

type ScopeFilter = "all" | RuleScope;
type SeverityFilter = "all" | RuleSeverity;

const SCOPE_OPTIONS: ReadonlyArray<{ readonly value: ScopeFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "global", label: "Global" },
  { value: "task", label: "Task-scoped" },
];

const SEVERITY_OPTIONS: ReadonlyArray<{ readonly value: SeverityFilter; readonly label: string }> = [
  { value: "all", label: "Any severity" },
  { value: "block", label: "Block" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
];

/**
 * `/rules` — workspace-wide rule management. Distinct from the per-task
 * Rules tab (Inspector → Rules) which only shows rules attached to *one*
 * task. Here we show every rule the server knows about, with scope +
 * severity filters and full CRUD.
 *
 * Layout reuses the design system tokens (canvas / s1 / hair) — single
 * column on narrow widths, scrollable content body, sticky-ish header.
 */
export function RulesPage() {
  const { data, isLoading, isError } = useRulesQuery();
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
    <div
      className="flex flex-col min-h-0"
      style={{ height: "100%", overflow: "auto" }}
    >
      <header
        className="px-9 pt-6 pb-4 flex flex-col gap-3"
        style={{ borderBottom: "1px solid var(--hair)" }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-tertiary)",
              }}
            >
              Workspace
            </p>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.3px",
              }}
            >
              Rules
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12.5,
                color: "var(--ink-subtle)",
              }}
            >
              {isLoading
                ? "Loading…"
                : data
                  ? `${data.rules.length} rule${data.rules.length === 1 ? "" : "s"} configured`
                  : "Couldn't load rules."}
            </p>
          </div>
          <button type="button" onClick={handleCreate} style={primaryButtonStyle}>
            + New rule
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ScopePills value={scope} onChange={setScope} />
          <span style={{ width: 1, height: 18, background: "var(--hair)" }} />
          <SeveritySelect value={severity} onChange={setSeverity} />
          <span className="flex-1 min-w-[120px]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={searchInputStyle}
          />
        </div>
      </header>

      <div className="px-9 py-6 flex flex-col gap-2.5">
        {isError && (
          <p style={{ color: "var(--err)", fontSize: 12.5 }}>
            Couldn't load rules. Check the monitor server connection.
          </p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-subtle)",
              textAlign: "center",
              padding: "32px 0",
            }}
          >
            {data && data.rules.length === 0
              ? "No rules configured yet. Create the first one above."
              : "No rules match the current filters."}
          </p>
        )}
        {filtered.map((rule) => (
          <RuleListItem key={rule.id} rule={rule} onEdit={handleEdit} />
        ))}
      </div>

      <Modal
        open={editorOpen}
        onClose={handleClose}
        title={editingRule ? "Edit rule" : "New rule"}
        description={
          editingRule
            ? "Update the rule's expectation, severity, or rationale."
            : "Define a new check that runs against agent events."
        }
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

interface RuleListItemProps {
  readonly rule: RuleRecord;
  readonly onEdit: (rule: RuleRecord) => void;
}

function RuleListItem({ rule, onEdit }: RuleListItemProps) {
  const promoteMutation = usePromoteRuleMutation();
  const deleteMutation = useDeleteRuleMutation();
  const [confirming, setConfirming] = useState(false);
  const isPending = promoteMutation.isPending || deleteMutation.isPending;

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 3500);
      return;
    }
    deleteMutation.mutate(rule.id);
  };

  return (
    <article
      style={{
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        opacity: isPending ? 0.5 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <RuleSeverityChip severity={rule.severity} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.05px",
            flex: 1,
            minWidth: 0,
          }}
        >
          {rule.name}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-tertiary)",
            padding: "2px 7px",
            background: "var(--s2)",
            borderRadius: 2,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {rule.scope}
        </span>
      </div>

      <div
        className="flex items-center gap-2 flex-wrap"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
        }}
      >
        <span>source · {rule.source}</span>
        {rule.expect.tool && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span>tool · {rule.expect.tool}</span>
          </>
        )}
        {rule.expect.pattern && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span title={rule.expect.pattern}>pattern</span>
          </>
        )}
        {rule.trigger?.phrases.length && (
          <>
            <span style={{ color: "var(--hair-strong)" }}>·</span>
            <span>{rule.trigger.phrases.length} trigger phrase{rule.trigger.phrases.length === 1 ? "" : "s"}</span>
          </>
        )}
      </div>

      {rule.rationale && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--ink-subtle)",
            lineHeight: 1.5,
          }}
        >
          {rule.rationale}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => onEdit(rule)}
          disabled={isPending}
          style={ghostButtonStyle}
        >
          Edit
        </button>
        {rule.scope === "task" && (
          <button
            type="button"
            onClick={() => promoteMutation.mutate(rule.id)}
            disabled={isPending}
            style={ghostButtonStyle}
          >
            Promote to global
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          style={{
            ...ghostButtonStyle,
            color: confirming || deleteMutation.isError ? "var(--err)" : "var(--ink-muted)",
            borderColor: confirming || deleteMutation.isError ? "var(--err)" : "var(--hair)",
            background: confirming
              ? "color-mix(in srgb, var(--err) 14%, transparent)"
              : "transparent",
          }}
        >
          {confirming ? "Click again to confirm" : deleteMutation.isError ? "Retry delete" : "Delete"}
        </button>
      </div>
    </article>
  );
}

function ScopePills({
  value,
  onChange,
}: {
  value: ScopeFilter;
  onChange: (next: ScopeFilter) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 2,
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      {SCOPE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: "4px 10px",
              fontSize: 11.5,
              fontWeight: active ? 600 : 400,
              color: active ? "var(--ink)" : "var(--ink-muted)",
              background: active ? "var(--s2)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SeveritySelect({
  value,
  onChange,
}: {
  value: SeverityFilter;
  onChange: (next: SeverityFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SeverityFilter)}
      style={{
        padding: "5px 8px",
        fontSize: 11.5,
        color: "var(--ink-muted)",
        background: "var(--s1)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-xs)",
      }}
    >
      {SEVERITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--canvas)",
  background: "var(--primary)",
  border: "1px solid var(--primary)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "5px 11px",
  fontSize: 11.5,
  color: "var(--ink-muted)",
  background: "transparent",
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
};

const searchInputStyle: React.CSSProperties = {
  width: 220,
  padding: "5px 9px",
  fontSize: 11.5,
  color: "var(--ink)",
  background: "var(--canvas)",
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-xs)",
  outline: "none",
};
