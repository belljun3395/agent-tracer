import type {
  EventClassificationMatch,
  TimelineEventRecord,
} from "~domain/monitoring.js";

interface RuleMatchesSectionProps {
  readonly event: TimelineEventRecord;
}

/**
 * Lists every classification match the rule engine attached to the event.
 * Highlights the section in red when the event also carries a `violation`
 * tag. Each match shows the rule id, score, lane override (if any), and
 * the reason chips (keyword / action-prefix / action-keyword) so the
 * operator can immediately see *why* the classifier picked this rule.
 */
export function RuleMatchesSection({ event }: RuleMatchesSectionProps) {
  const matches = event.classification.matches;
  if (matches.length === 0) return null;

  const isViolation = event.classification.tags.includes("violation");
  const tone = isViolation ? VIOLATION_TONE : NEUTRAL_TONE;

  return (
    <div
      className="mt-4 rounded-[var(--radius-md)] p-3"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: tone.label,
        }}
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-sm"
          style={{ background: tone.label }}
        />
        <span>
          {isViolation ? "Rule violation" : "Rule matches"} · {matches.length}
        </span>
      </div>

      <ul className="mt-2 m-0 p-0 list-none flex flex-col gap-2">
        {matches.map((match, idx) => (
          <RuleMatchItem key={`${match.ruleId}-${idx}`} match={match} />
        ))}
      </ul>
    </div>
  );
}

const VIOLATION_TONE = {
  bg: "color-mix(in srgb, var(--err) 6%, var(--s1))",
  border: "color-mix(in srgb, var(--err) 50%, transparent)",
  label: "var(--err)",
};

const NEUTRAL_TONE = {
  bg: "var(--s1)",
  border: "var(--hair)",
  label: "var(--ink-tertiary)",
};

function RuleMatchItem({ match }: { match: EventClassificationMatch }) {
  return (
    <li
      className="rounded-[var(--radius-sm)] px-2.5 py-2"
      style={{ background: "var(--canvas)", border: "1px solid var(--hair)" }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--ink)",
          }}
        >
          {match.ruleId}
        </span>
        <span
          className="ml-auto"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-subtle)",
          }}
        >
          score {match.score.toFixed(2)}
        </span>
      </div>

      <div
        className="flex items-center gap-2 flex-wrap mt-1"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
        }}
      >
        {match.lane && (
          <span>
            lane <span style={{ color: "var(--ink-muted)" }}>{match.lane}</span>
          </span>
        )}
        {match.source && <span>via {match.source}</span>}
      </div>

      {match.reasons.length > 0 && (
        <ul className="mt-1.5 m-0 p-0 list-none flex flex-wrap gap-1">
          {match.reasons.map((r, i) => (
            <li
              key={i}
              className="inline-flex items-center px-1.5 py-[1px] rounded-[var(--radius-xs)]"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-muted)",
                background: "var(--s2)",
                border: "1px solid var(--hair)",
              }}
            >
              <span style={{ color: "var(--ink-tertiary)", marginRight: 4 }}>
                {r.kind}
              </span>
              {r.value}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
