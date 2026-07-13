import { EventId } from "~web/shared/identity.js";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~web/shared/store/index.js";
import { formatHHmmss } from "~web/shared/lib/formatting/time.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import type { SpanTreeRow } from "~web/widgets/inspector/tabs/trace/lib/build-span-tree.js";
import { SpanKindChip } from "~web/widgets/inspector/tabs/trace/SpanKindChip.js";

interface SpanRowProps {
  readonly row: SpanTreeRow;
}

const INDENT_PX = 14;

/** trace 트리의 행 하나. */
export function SpanRow({ row }: SpanRowProps) {
  const selectedEventId = useSelectedEventId();
  const setSelectedEventId = useSetSelectedEventId();
  const { span, depth, elapsedMsFromRoot } = row;
  const active = selectedEventId === span.spanId;
  const startClock = formatHHmmss(span.startTime);
  const elapsed =
    elapsedMsFromRoot !== null && elapsedMsFromRoot > 0
      ? `+${formatDuration(elapsedMsFromRoot)}`
      : null;

  return (
    <button
      type="button"
      onClick={() => setSelectedEventId(EventId(span.spanId))}
      className={cn(
        "w-full flex items-center gap-2 py-1.5 pr-2 rounded-xs border-l-2",
        "hover:bg-s2 transition-colors text-left",
        active ? "bg-s2 border-primary" : "bg-transparent border-transparent",
      )}
      style={{ paddingLeft: 8 + depth * INDENT_PX }}
    >
      <SpanKindChip kind={span.kind} />
      <span className="flex-1 truncate text-xs text-ink-muted font-mono tracking-[-0.05px]">
        {span.name || span.kind.toLowerCase()}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-ink-tertiary">
        {startClock}
        {elapsed && <span className="ml-1.5">{elapsed}</span>}
      </span>
    </button>
  );
}
