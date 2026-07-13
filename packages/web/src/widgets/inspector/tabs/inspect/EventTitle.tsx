import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { formatHHmmss } from "~web/shared/lib/formatting/time.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";

interface EventTitleProps {
  readonly event: TimelineEventRecord;
}

/** Inspect 섹션 안의 H2와 시각·(메타데이터에 있으면) 소요 시간을 보여주는 작은 서브라인. */
export function EventTitle({ event }: EventTitleProps) {
  const ts = Date.parse(event.createdAt);
  const subline = buildSubline(event, ts);

  return (
    <div className="mt-1.5">
      <h2 className="m-0 text-base font-semibold tracking-[-0.3px] text-ink leading-[1.35]">
        {event.title}
      </h2>
      <p className="mt-1.5 font-mono text-[11px] text-ink-subtle">
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
