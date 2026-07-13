import type { RuleSeverity } from "~web/entities/rule/model/rule.js";

interface RuleSeverityChipProps {
  readonly severity: RuleSeverity;
}

const TONE: Record<RuleSeverity, { color: string; bg: string }> = {
  info: {
    color: "var(--ink-muted)",
    bg: "var(--s2)",
  },
  warn: {
    color: "var(--warn)",
    bg: "color-mix(in srgb, var(--warn) 14%, transparent)",
  },
  block: {
    color: "var(--err)",
    bg: "color-mix(in srgb, var(--err) 14%, transparent)",
  },
};

export function RuleSeverityChip({ severity }: RuleSeverityChipProps) {
  const tone = TONE[severity];
  return (
    <span
      className="inline-flex items-center rounded-xs px-1.5 font-mono text-[9.5px] font-semibold tracking-[0.08em] uppercase leading-4"
      style={{ color: tone.color, background: tone.bg }}
    >
      {severity}
    </span>
  );
}
