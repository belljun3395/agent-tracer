import type { VerdictStatus } from "~web/entities/rule/model/rule.js";

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

/** 새 턴 밴드를 여는 구분선. */
export function TurnMark({ turnIndex, verdict, status }: TurnMarkProps) {
  const tone = verdict ? VERDICT_TONE[verdict] : null;
  const accent = tone?.color ?? "var(--ink-tertiary)";
  const verdictLabel =
    tone?.label ?? (status === "open" ? "open" : "no verdict");

  return (
    <div
      className="flex items-center gap-2.5 py-3 font-mono text-[10.5px] uppercase tracking-[0.04em]"
      style={{ color: accent }}
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
