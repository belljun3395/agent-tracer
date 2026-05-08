import { useEffect, useRef } from "react";
import type { FeedItem } from "./lib/group-acts.js";
import { ActCard } from "./ActCard.js";
import { TimeMark } from "./TimeMark.js";
import { TurnMark } from "./TurnMark.js";

interface ActListProps {
  readonly items: readonly FeedItem[];
}

/**
 * Vertical timeline body. The implicit rail is rendered as a thin
 * absolutely-positioned line at x=78px (= clock column + half gap), so
 * each ActCard's lane-colored dot lands on it.
 *
 * Three FeedItem variants render here:
 *   - time-mark : Task started / Context compacted
 *   - turn-mark : Turn N · verdict band header
 *   - act       : the actual card
 *
 * Auto-focus: every time the list grows (new event arrives), scroll the
 * tail anchor into view. We track `items.length` so a route change that
 * swaps a different feed in scrolls to its tail on first paint, and live
 * updates land at the bottom without the operator having to chase them.
 */
export function ActList({ items }: ActListProps) {
  const tailRef = useRef<HTMLDivElement>(null);
  const lastLengthRef = useRef(0);

  useEffect(() => {
    if (items.length === 0) return;
    // Only scroll when the list actually grew (or first mount). Avoids
    // hijacking the user when they manually scroll up to inspect history.
    if (items.length === lastLengthRef.current) return;
    const grew = items.length > lastLengthRef.current;
    lastLengthRef.current = items.length;
    if (!grew) return;
    tailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [items.length]);

  return (
    <div className="relative pb-20">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 w-px"
        style={{ left: 78, background: "var(--hair)" }}
      />
      {items.map((item, idx) => {
        if (item.kind === "time-mark") {
          return (
            <TimeMark
              key={`mark-${idx}`}
              label={item.label}
              tone={item.tone}
              {...(item.count !== undefined ? { count: item.count } : {})}
            />
          );
        }
        if (item.kind === "turn-mark") {
          return (
            <TurnMark
              key={`turn-${item.turnIndex}-${idx}`}
              turnIndex={item.turnIndex}
              verdict={item.verdict}
              status={item.status}
            />
          );
        }
        return <ActCard key={item.vm.event.id} vm={item.vm} />;
      })}
      <div ref={tailRef} aria-hidden style={{ height: 1 }} />
    </div>
  );
}
