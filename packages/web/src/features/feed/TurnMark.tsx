import type { VerdictStatus } from "~domain/rule.js";

interface TurnMarkProps {
  readonly turnIndex: number;
  readonly verdict: VerdictStatus | null;
  readonly status: "open" | "closed";
}

const VERDICT_TONE: Record<
  VerdictStatus,
  { readonly label: string; readonly color: string }
> = {
  verified: { label: "verified", color: "var(--ok)" },
  contradicted: { label: "contradicted", color: "var(--err)" },
  unverifiable: { label: "unverifiable", color: "var(--warn)" },
};

/**
 * Divider that opens a new turn band. Sits between acts wherever the feed
 * crosses into a new turn. Verdict dictates the accent — green/red/amber
 * for known verdicts, neutral grey when the turn is still open or not
 * yet evaluated.
 */
export function TurnMark({ turnIndex, verdict, status }: TurnMarkProps) {
  const tone = verdict ? VERDICT_TONE[verdict] : null;
  const accent = tone?.color ?? "var(--ink-tertiary)";
  const verdictLabel =
    tone?.label ?? (status === "open" ? "open" : "no verdict");

  return (
    <div
      className="flex items-center gap-2.5 py-3"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: accent,
      }}
    >
      <Hairline color={accent} />
      <span>
        — Turn {turnIndex + 1} · {verdictLabel} —
      </span>
      <Hairline color={accent} />
    </div>
  );
}

function Hairline({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="flex-1"
      style={{
        borderTop: `1px dashed color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    />
  );
}
