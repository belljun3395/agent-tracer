import { useState } from "react";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~web/shared/store/index.js";
import { useEventMemoCountsForTask } from "~web/entities/memo/lib/use-event-memo-counts-for-task.js";
import type { PositionedNode } from "~web/widgets/feed/graph/model/node-layout.js";
import { LANE_HEIGHT, trackLeftCss } from "~web/widgets/feed/graph/model/track-geometry.js";
import { cn } from "~web/shared/ui/lib/cn.js";

interface GraphNodeProps {
  readonly node: PositionedNode;
}

const NODE_DIAMETER = 14;
const LABEL_MAX_CHARS = 24;

/** 스윔레인 위의 원 하나. */
export function GraphNode({ node }: GraphNodeProps) {
  const selectedEventId = useSelectedEventId();
  const setSelectedEventId = useSetSelectedEventId();
  const [hovered, setHovered] = useState(false);
  const focused = selectedEventId === node.vm.event.id;
  const top = node.laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 + node.yOffset;
  const verificationCount = node.verification?.verifications.length ?? 0;
  const memoCount = useEventMemoCountsForTask(node.vm.event.taskId).get(node.vm.event.id) ?? 0;

  // 성긴 노드는 라벨을 항상 보여주고, 밀집 노드는 hover/focus에서만 보여준다(그렇지 않으면 이웃 라벨끼리 심하게 겹친다).
  const showLabel = hovered || focused || !node.dense;
  const labelText = hovered
    ? `${node.vm.lane.label} · ${node.vm.toolName}${
        node.vm.hasViolation ? " · violation" : ""
      } · ${node.vm.clockLabel}`
    : truncate(node.vm.toolName, LABEL_MAX_CHARS);

  const accent =
    focused || hovered ? "var(--primary)" : "var(--hair)";
  const labelColor =
    focused || hovered ? "var(--ink)" : "var(--ink-muted)";

  return (
    <button
      type="button"
      aria-label={
        verificationCount > 0
          ? `${node.vm.toolName} · ${verificationCount} verified rule${verificationCount === 1 ? "" : "s"}`
          : node.vm.toolName
      }
      onClick={() => setSelectedEventId(node.vm.event.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="absolute rounded-full transition-transform hover:scale-125 -translate-x-1/2 -translate-y-1/2 bg-canvas"
      style={{
        left: trackLeftCss(node.leftPercent),
        top,
        width: NODE_DIAMETER,
        height: NODE_DIAMETER,
        border: `2px solid ${node.vm.lane.cssColor}`,
        color: node.vm.lane.cssColor,
        boxShadow: focused
          ? `0 0 0 4px color-mix(in srgb, ${node.vm.lane.cssColor} 35%, transparent)`
          : node.vm.hasViolation
            ? `0 0 0 3px color-mix(in srgb, var(--err) 50%, transparent)`
            : "none",
        zIndex: hovered ? 10 : focused ? 6 : 2,
      }}
    >
      {node.vm.hasViolation && (
        <span
          aria-hidden
          className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full w-3.5 h-3.5 bg-err text-white font-mono text-[9px] font-bold"
        >
          !
        </span>
      )}
      {verificationCount > 0 && (
        <span
          aria-hidden
          className="absolute -bottom-2 -right-2 inline-flex items-center justify-center rounded-full min-w-3.5 h-3.5 px-0.5 bg-ph-veri text-white font-mono text-[8px] font-bold"
        >
          {verificationCount === 1 ? "✓" : `✓${verificationCount}`}
        </span>
      )}
      {memoCount > 0 && (
        <span
          aria-hidden
          className="absolute -bottom-2 -left-2 inline-flex items-center justify-center rounded-full min-w-3.5 h-3.5 px-0.5 bg-primary text-white font-mono text-[8px] font-bold"
        >
          {memoCount}
        </span>
      )}
      {showLabel && (
        <span
          aria-hidden
          className={cn(
            "absolute -top-[22px] left-1/2 -translate-x-1/2 py-px px-[5px] truncate bg-canvas font-mono text-[10px] rounded-[3px] pointer-events-none transition-[border-color,color,max-width] duration-150",
            hovered ? "max-w-[320px]" : "max-w-[220px]",
          )}
          style={{
            color: labelColor,
            border: `1px solid ${accent}`,
            zIndex: hovered ? 11 : focused ? 7 : 3,
          }}
        >
          {labelText}
        </span>
      )}
    </button>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
