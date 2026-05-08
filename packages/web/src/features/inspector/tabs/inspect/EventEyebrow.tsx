import type { TimelineEventRecord } from "~domain/monitoring.js";
import { laneThemeForEvent } from "~features/feed/lib/lane-theme.js";

interface EventEyebrowProps {
  readonly event: TimelineEventRecord;
}

/**
 * Top caption of the inspect section — colored swatch + LANE label +
 * truncated event id (acts as a stable "seq" reference). Reuses the feed's
 * lane-theme adapter so colors stay consistent with the timeline.
 */
export function EventEyebrow({ event }: EventEyebrowProps) {
  const lane = laneThemeForEvent(event);
  const shortId = event.id.slice(-8);

  return (
    <div
      className="flex items-center gap-2"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: lane.cssColor,
      }}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-sm"
        style={{ background: lane.cssColor }}
      />
      <span>{lane.label} · seq {shortId}</span>
    </div>
  );
}
