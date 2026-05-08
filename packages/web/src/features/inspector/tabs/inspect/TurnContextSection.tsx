import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import type { VerdictStatus } from "~domain/rule.js";
import { formatHHmm } from "~features/feed/lib/format-time.js";

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

/**
 * Pinned just below the event title — answers "which turn am I in, and
 * how did the rule engine score that turn overall?" without forcing the
 * user to flip back to the timeline.
 *
 * Renders nothing when the event isn't inside any known turn (server
 * hasn't materialised turns for the task yet, or the timestamp falls
 * outside every turn window).
 */
export function TurnContextSection({ turn }: TurnContextSectionProps) {
  if (!turn) return null;

  const startLabel = formatHHmm(turn.startedAt);
  const endLabel = turn.endedAt ? formatHHmm(turn.endedAt) : "now";

  return (
    <div
      className="mt-3 rounded-[var(--radius-sm)] px-3 py-2.5"
      style={{
        background: "var(--s2)",
        border: "1px solid var(--hair)",
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-tertiary)",
        }}
      >
        <span>TURN {turn.turnIndex + 1}</span>
        <span>·</span>
        <span>
          {startLabel} – {endLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <VerdictPill verdict={turn.aggregateVerdict} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-subtle)",
          }}
        >
          {turn.rulesEvaluatedCount}{" "}
          {turn.rulesEvaluatedCount === 1 ? "rule" : "rules"} evaluated
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-tertiary)",
            marginLeft: "auto",
          }}
        >
          {turn.status}
        </span>
      </div>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: VerdictStatus | null }) {
  if (!verdict) {
    return (
      <span
        className="inline-flex items-center px-2 py-[1px] rounded-[var(--radius-pill)]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
          border: "1px solid var(--hair)",
        }}
      >
        no verdict
      </span>
    );
  }
  const tone = VERDICT_TONE[verdict];
  return (
    <span
      className="inline-flex items-center px-2 py-[1px] rounded-[var(--radius-pill)]"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: tone.color,
        background: tone.bg,
      }}
    >
      {tone.label}
    </span>
  );
}
