import { useState } from "react";
import {
  useSelectedEventId,
  useSetSelectedEventId,
} from "~state/ui/index.js";
import type { PositionedNode } from "./lib/layout.js";
import { LANE_HEIGHT, trackLeftCss } from "./lib/layout.js";

interface GraphNodeProps {
  readonly node: PositionedNode;
}

const NODE_DIAMETER = 14;
const LABEL_MAX_CHARS = 24;

/**
 * Single circle on the swimlane with a unified always-visible label that
 * expands on hover.
 *
 * Why single layer (no Radix Tooltip):
 *   The always-visible label and a hover tooltip would both render above
 *   the node — they'd stack visually and fight for the same space. We
 *   collapse them into one element: the label sits above the node at all
 *   times; on hover its content expands to lane · tool · clock, the
 *   border picks up the primary tint, and z-index lifts so it overlays
 *   neighbouring labels rather than getting hidden under them.
 *
 * Visual contract:
 *   - Color  = lane (matches feed cards)
 *   - Position = (lane row center) + node.yOffset (vertical stagger)
 *   - Label idle  : tool name truncated to LABEL_MAX_CHARS, hair border
 *   - Label hover : full lane · tool · clock, primary border, raised z
 *   - Focus       : primary border + thicker ring on the node
 *   - Violation   : red outer ring + ! badge
 *
 * Click toggles selection in the shared UI store.
 */
export function GraphNode({ node }: GraphNodeProps) {
  const selectedEventId = useSelectedEventId();
  const setSelectedEventId = useSetSelectedEventId();
  const [hovered, setHovered] = useState(false);
  const focused = selectedEventId === node.vm.event.id;
  const top = node.laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 + node.yOffset;

  // Show label always for sparse nodes; defer to hover/focus for dense
  // ones (otherwise neighbouring labels overlap horribly — see screenshot
  // feedback). Hover always wins so the operator can dig into clusters.
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
      aria-label={node.vm.toolName}
      onClick={() => setSelectedEventId(node.vm.event.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="absolute rounded-full transition-transform hover:scale-125"
      style={{
        left: trackLeftCss(node.leftPercent),
        top,
        width: NODE_DIAMETER,
        height: NODE_DIAMETER,
        transform: "translate(-50%, -50%)",
        background: "var(--canvas)",
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
          className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full"
          style={{
            width: 14,
            height: 14,
            background: "var(--err)",
            color: "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          !
        </span>
      )}
      {showLabel && (
        <span
          aria-hidden
          className="absolute"
          style={{
            top: -22,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "1px 5px",
            maxWidth: hovered ? 320 : 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            background: "var(--canvas)",
            color: labelColor,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            border: `1px solid ${accent}`,
            borderRadius: 3,
            pointerEvents: "none",
            zIndex: hovered ? 11 : focused ? 7 : 3,
            letterSpacing: 0,
            transition:
              "border-color 150ms, color 150ms, max-width 150ms",
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
