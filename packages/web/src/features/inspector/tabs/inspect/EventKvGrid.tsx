import type { TimelineEventRecord } from "~domain/monitoring.js";
import { eventToKvPairs } from "~features/inspector/lib/event-to-kv.js";

interface EventKvGridProps {
  readonly event: TimelineEventRecord;
}

/**
 * Two-column key/value grid (~78px gutter). Keys render in monospace
 * tertiary; values in monospace muted. Emits nothing when the underlying
 * `eventToKvPairs` finds no surfacable fields — keeps the inspector lean.
 */
export function EventKvGrid({ event }: EventKvGridProps) {
  const pairs = eventToKvPairs(event);
  if (pairs.length === 0) return null;

  return (
    <dl
      className="mt-3 grid gap-y-1.5 gap-x-3"
      style={{
        gridTemplateColumns: "78px 1fr",
        fontSize: 12,
      }}
    >
      {pairs.map((pair) => (
        <KvRow key={pair.key} pair={pair} />
      ))}
    </dl>
  );
}

function KvRow({ pair }: { pair: { key: string; value: string } }) {
  return (
    <>
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.04em",
          color: "var(--ink-tertiary)",
          paddingTop: 1,
        }}
      >
        {pair.key}
      </dt>
      <dd
        className="m-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--ink-muted)",
          wordBreak: "break-all",
        }}
      >
        {pair.value}
      </dd>
    </>
  );
}
