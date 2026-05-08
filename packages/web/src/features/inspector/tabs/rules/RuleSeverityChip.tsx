import type { RuleSeverity } from "~domain/rule.js";

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
      className="inline-flex items-center rounded-[var(--radius-xs)] px-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tone.color,
        background: tone.bg,
        lineHeight: "16px",
      }}
    >
      {severity}
    </span>
  );
}
