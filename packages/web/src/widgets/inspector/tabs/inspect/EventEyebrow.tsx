import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { laneThemeForEvent } from "~web/entities/task/model/lane-theme.js";

interface EventEyebrowProps {
  readonly event: TimelineEventRecord;
}

/** Inspector 이벤트의 레인 테마와 짧은 식별자를 표시한다. */
export function EventEyebrow({ event }: EventEyebrowProps) {
  const lane = laneThemeForEvent(event);
  const shortId = event.id.slice(-8);

  return (
    <div
      className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]"
      style={{ color: lane.cssColor }}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-[2px]"
        style={{ background: lane.cssColor }}
      />
      <span>{lane.label} · seq {shortId}</span>
    </div>
  );
}
