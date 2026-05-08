import type { ActVm } from "./lib/act-classification.js";

interface ActHeaderProps {
  readonly vm: ActVm;
}

/**
 * Top row of an act card — `LANE → tool name`, with an optional red
 * `viol` chip pushed to the right edge when the classifier flagged a
 * violation.
 */
export function ActHeader({ vm }: ActHeaderProps) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: vm.lane.cssColor,
        }}
      >
        {vm.lane.label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--hair-strong)",
        }}
      >
        →
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--ink-muted)",
        }}
      >
        {vm.toolName}
      </span>
      {vm.hasViolation && (
        <span
          className="ml-auto rounded-[var(--radius-xs)] px-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--err)",
            background: "color-mix(in srgb, var(--err) 14%, transparent)",
            letterSpacing: "0.02em",
          }}
        >
          viol
        </span>
      )}
    </div>
  );
}
