import type { RuleSeverity } from "~web/entities/rule/model/rule.js";
import { Input, Select } from "~web/shared/ui/index.js";

export type SeverityFilter = "all" | RuleSeverity;

const SEVERITY_OPTIONS: ReadonlyArray<{ readonly value: SeverityFilter; readonly label: string }> = [
  { value: "all", label: "Any severity" },
  { value: "block", label: "Block" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
];

interface RuleFilterBarProps {
  readonly severity: SeverityFilter;
  readonly onSeverityChange: (next: SeverityFilter) => void;
  readonly search: string;
  readonly onSearchChange: (next: string) => void;
}

export function RuleFilterBar({
  severity,
  onSeverityChange,
  search,
  onSearchChange,
}: RuleFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
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
