import { EventId } from "~domain/monitoring.js";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~state/ui/index.js";
import {
  formatDuration,
  formatHHmmss,
} from "~features/feed/lib/format-time.js";
import { cn } from "~lib/cn.js";
import type { SpanTreeRow } from "./lib/build-span-tree.js";
import { SpanKindChip } from "./SpanKindChip.js";

interface SpanRowProps {
  readonly row: SpanTreeRow;
}

const INDENT_PX = 14;

/**
 * One row in the trace tree. Indents per depth, shows kind + name + clock,
 * and links into the existing event selection — clicking a span sets
 * `selectedEventId` (spanId === eventId by construction in the server
 * export) so the Inspect tab can sync.
 */
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
        "w-full flex items-center gap-2 py-1.5 pr-2 rounded-[var(--radius-xs)]",
        "hover:bg-[var(--s2)] transition-colors text-left",
      )}
      style={{
        paddingLeft: 8 + depth * INDENT_PX,
        background: active ? "var(--s2)" : "transparent",
        borderLeft: active
          ? "2px solid var(--primary)"
          : "2px solid transparent",
      }}
    >
      <SpanKindChip kind={span.kind} />
      <span
        className="flex-1 truncate"
        style={{
          fontSize: 12,
          color: "var(--ink-muted)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "-0.05px",
        }}
      >
        {span.name || span.kind.toLowerCase()}
      </span>
      <span
        className="shrink-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--ink-tertiary)",
        }}
      >
        {startClock}
        {elapsed && <span className="ml-1.5">{elapsed}</span>}
      </span>
    </button>
  );
}
