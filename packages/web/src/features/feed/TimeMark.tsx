import { cn } from "~lib/cn.js";

interface TimeMarkProps {
  readonly label: string;
  readonly tone?: "normal" | "compact";
  /**
   * Optional repeat count. When > 1, renders as `— Context compacted ×N —`.
   * Used to collapse a flurry of back-to-back `context.saved` events into
   * one divider so the feed doesn't drown in dashed lines.
   */
  readonly count?: number;
}

/**
 * Horizontal divider between feed sections. Pairs of dashed hairlines
 * flanking an UPPERCASE caption — "Task started · 14:03:12" or
 * "Context compacted" (compact tone uses amber).
 */
export function TimeMark({ label, tone = "normal", count }: TimeMarkProps) {
  const isCompact = tone === "compact";
  const showCount = typeof count === "number" && count > 1;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-3",
        "text-[10.5px] uppercase tracking-[0.04em] font-[var(--font-mono)]",
      )}
      style={{ color: isCompact ? "var(--warn)" : "var(--ink-tertiary)" }}
    >
      <Hairline compact={isCompact} />
      <span>
        — {label}
        {showCount && (
          <span style={{ marginLeft: 6, color: "var(--warn)" }}>×{count}</span>
        )}{" "}
        —
      </span>
      <Hairline compact={isCompact} />
    </div>
  );
}

function Hairline({ compact }: { compact: boolean }) {
  return (
    <span
      aria-hidden
      className="flex-1"
      style={{
        borderTop: compact
          ? "1px dashed color-mix(in srgb, var(--compact) 50%, transparent)"
          : "1px dashed var(--hair)",
      }}
    />
  );
}
