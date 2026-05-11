import type { ActVm } from "./lib/act-classification.js";

interface ActHeaderProps {
  readonly vm: ActVm;
}

/**
 * Top row of an act card — `[LANE chip] · tool name`, with an optional
 * red `viol` chip pushed to the right edge when the classifier flagged
 * a violation. The lane chip now renders with a tinted background so
 * the eye reads it as a category tag instead of a coloured word.
 */
export function ActHeader({ vm }: ActHeaderProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="inline-flex items-center rounded-[var(--radius-xs)] px-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: vm.lane.cssColor,
          background: `color-mix(in srgb, ${vm.lane.cssColor} 14%, transparent)`,
          lineHeight: "16px",
        }}
      >
        {vm.lane.label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--ink)",
          fontWeight: 500,
          letterSpacing: "-0.05px",
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
