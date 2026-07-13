import type { TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import { msToLeftPercent } from "~web/widgets/feed/graph/model/time-range.js";
import { trackLeftCss } from "~web/widgets/feed/graph/model/track-geometry.js";

interface NowMarkerProps {
  readonly nowMs: number;
  readonly range: TimeRange;
}

/** 레인 전체를 가로지르는 세로 "now" 선. */
export function NowMarker({ nowMs, range }: NowMarkerProps) {
  const leftPercent = msToLeftPercent(nowMs, range);
  if (leftPercent <= 0 || leftPercent >= 100) return null;

  return (
    <div
      aria-hidden
      className="absolute top-0 bottom-0 pointer-events-none w-px bg-ink z-[6]"
      style={{ left: trackLeftCss(leftPercent) }}
    >
      <span className="absolute left-1/2 -translate-x-1/2 top-1.5 py-px px-1.5 bg-ink text-canvas font-mono text-[8.5px] font-bold tracking-[0.1em] rounded-[2px]">
        NOW
      </span>
    </div>
  );
}
