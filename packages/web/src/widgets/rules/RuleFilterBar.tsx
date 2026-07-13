import type { RuleScope, RuleSeverity } from "~web/entities/rule/model/rule.js";
import { Input, Select } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

export type ScopeFilter = "all" | RuleScope;
export type SeverityFilter = "all" | RuleSeverity;

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

interface RuleFilterBarProps {
  readonly scope: ScopeFilter;
  readonly onScopeChange: (next: ScopeFilter) => void;
  readonly severity: SeverityFilter;
  readonly onSeverityChange: (next: SeverityFilter) => void;
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
}

export function RuleFilterBar({
  scope,
  onScopeChange,
  severity,
  onSeverityChange,
  search,
  onSearchChange,
}: RuleFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ScopePills value={scope} onChange={onScopeChange} />
      <span className="w-px h-[18px] bg-hair" />
      <Select
        value={severity}
        onChange={(e) => onSeverityChange(e.target.value as SeverityFilter)}
        className="text-[11.5px] text-ink-muted bg-s1 py-[5px]"
      >
        {SEVERITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <span className="flex-1 min-w-[120px]" />
      <Input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name…"
        className="w-[220px] text-[11.5px] py-[5px]"
      />
    </div>
  );
}

function ScopePills({
  value,
  onChange,
}: {
  readonly value: ScopeFilter;
  readonly onChange: (next: ScopeFilter) => void;
}) {
  return (
    <div className="inline-flex p-0.5 bg-s1 border border-hair rounded-sm">
      {SCOPE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "py-1 px-2.5 text-[11.5px] border-none rounded-xs cursor-pointer",
              active ? "font-semibold text-ink bg-s2" : "font-normal text-ink-muted bg-transparent",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
