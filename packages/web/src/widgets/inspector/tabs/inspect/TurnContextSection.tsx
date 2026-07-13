import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { formatHHmm } from "~web/shared/lib/formatting/time.js";

interface TurnContextSectionProps {
  readonly turn: TaskTurnSummary | undefined;
}

const VERDICT_TONE: Record<
  VerdictStatus,
  { readonly label: string; readonly color: string; readonly bg: string }
> = {
  verified: {
    label: "Verified",
    color: "var(--ok)",
    bg: "color-mix(in srgb, var(--ok) 14%, transparent)",
  },
  contradicted: {
    label: "Contradicted",
    color: "var(--err)",
    bg: "color-mix(in srgb, var(--err) 14%, transparent)",
  },
  unverifiable: {
    label: "Unverifiable",
    color: "var(--warn)",
    bg: "color-mix(in srgb, var(--warn) 14%, transparent)",
  },
};

/** 이벤트 제목 바로 아래 고정된다. */
export function TurnContextSection({ turn }: TurnContextSectionProps) {
  if (!turn) return null;

  const startLabel = formatHHmm(turn.startedAt);
  const endLabel = turn.endedAt ? formatHHmm(turn.endedAt) : "now";

  return (
    <div className="mt-3 rounded-sm px-3 py-2.5 bg-s2 border border-hair">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
        <span>TURN {turn.turnIndex + 1}</span>
        <span>·</span>
        <span>
          {startLabel} – {endLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <VerdictPill verdict={turn.aggregateVerdict} />
        <span className="font-mono text-[11px] text-ink-subtle">
          {turn.rulesEvaluatedCount}{" "}
          {turn.rulesEvaluatedCount === 1 ? "rule" : "rules"} evaluated
        </span>
        <span className="font-mono text-[11px] text-ink-tertiary ml-auto">
          {turn.status}
        </span>
      </div>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: VerdictStatus | null }) {
  if (!verdict) {
    return (
      <span className="inline-flex items-center px-2 py-[1px] rounded-pill font-mono text-[10.5px] text-ink-tertiary border border-hair">
        no verdict
      </span>
    );
  }
  const tone = VERDICT_TONE[verdict];
  return (
    <span
      className="inline-flex items-center px-2 py-[1px] rounded-pill font-mono text-[10.5px]"
      style={{ color: tone.color, background: tone.bg }}
    >
      {tone.label}
    </span>
  );
}
