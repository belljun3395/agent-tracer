import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { Hairline } from "~web/widgets/feed/timeline/Hairline.js";

interface TurnMarkProps {
  readonly turnIndex: number;
  readonly verdict: VerdictStatus | null;
  readonly status: "open" | "closed";
}

const VERDICT_TONE: Record<
  VerdictStatus,
  { readonly label: string; readonly color: string }
> = {
  satisfied: { label: "fulfilled", color: "var(--ok)" },
  unmet: { label: "unmet", color: "var(--err)" },
  open: { label: "not yet", color: "var(--warn)" },
  unknown: { label: "unverified", color: "var(--ink-tertiary)" },
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
      <Hairline color={`color-mix(in srgb, ${accent} 45%, transparent)`} />
      <span>
        — Turn {turnIndex + 1} · {verdictLabel} —
      </span>
      <Hairline color={`color-mix(in srgb, ${accent} 45%, transparent)`} />
    </div>
  );
}

