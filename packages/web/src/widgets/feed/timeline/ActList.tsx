import { useEffect, useMemo, useRef } from "react";
import { useVisibleLanes } from "~web/shared/store/index.js";
import type { FeedItem } from "~web/widgets/feed/lib/timeline/group-acts.js";
import { ActCard } from "~web/widgets/feed/timeline/ActCard.js";
import { TimeMark } from "~web/widgets/feed/timeline/TimeMark.js";
import { TurnMark } from "~web/widgets/feed/timeline/TurnMark.js";
import { ContextMark } from "~web/widgets/feed/timeline/ContextMark.js";

interface ActListProps {
  readonly items: readonly FeedItem[];
}

/** 세로 타임라인 본문. */
export function ActList({ items }: ActListProps) {
  const tailRef = useRef<HTMLDivElement>(null);
  const lastLengthRef = useRef(0);
  const visibleLanes = useVisibleLanes();
  const visibleLaneSet = useMemo<ReadonlySet<string>>(
    () => new Set(visibleLanes),
    [visibleLanes],
  );

  // 레인 필터로 숨겨진 레인의 act는 제외한다.
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          item.kind !== "act" || visibleLaneSet.has(item.vm.lane.key),
      ),
    [items, visibleLaneSet],
  );

  useEffect(() => {
    if (filtered.length === 0) return;
    // 목록이 실제로 늘어났을 때(또는 첫 마운트)만 스크롤한다.
    if (filtered.length === lastLengthRef.current) return;
    const grew = filtered.length > lastLengthRef.current;
    lastLengthRef.current = filtered.length;
    if (!grew) return;
    tailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [filtered.length]);

  return (
    <div className="relative pb-20">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 w-px bg-hair"
        style={{ left: 78 }}
      />
      {filtered.map((item, idx) => {
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
        if (item.kind === "context-mark") {
          return (
            <ContextMark
              key={`ctx-${idx}`}
              percent={item.percent}
              model={item.model}
              modelChanged={item.modelChanged}
              deltaPct={item.deltaPct}
            />
          );
        }
        return <ActCard key={item.vm.event.id} vm={item.vm} />;
      })}
      <div ref={tailRef} aria-hidden className="h-px" />
    </div>
  );
}
