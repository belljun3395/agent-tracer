import type { TimelineEventRecord } from "~domain/monitoring.js";
import {
  formatDuration,
  formatHHmmss,
} from "~features/feed/lib/format-time.js";

interface EventTitleProps {
  readonly event: TimelineEventRecord;
}

/**
 * The H2 inside the Inspect section + a small sub-line with the wall-clock
 * timestamp and (when metadata carries it) a duration.
 *
 * Body content is rendered separately by `EventBodySection` so this stays
 * a pure header — code blocks and prose require different layout treatment
 * and don't belong squashed inside the title block.
 */
export function EventTitle({ event }: EventTitleProps) {
  const ts = Date.parse(event.createdAt);
  const subline = buildSubline(event, ts);

  return (
    <div className="mt-1.5">
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.3px",
          color: "var(--ink)",
          lineHeight: 1.35,
        }}
      >
        {event.title}
      </h2>
      <p
        className="mt-1.5"
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--ink-subtle)",
        }}
      >
        {subline}
      </p>
    </div>
  );
}

function buildSubline(event: TimelineEventRecord, eventMs: number): string {
  const parts: string[] = [formatHHmmss(eventMs)];
  const dur = readNumber(event.metadata, "durationMs", "duration_ms");
  if (dur !== null && dur > 0) {
    parts.push(formatDuration(dur));
  }
  return parts.join(" · ");
}

function readNumber(
  meta: Record<string, unknown>,
  ...keys: readonly string[]
): number | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
