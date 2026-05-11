import { laneThemeFor, type LaneKey } from "~features/feed/lib/lane-theme.js";
import { LANE_HEIGHT, LANE_LABEL_WIDTH } from "./lib/layout.js";

interface GraphLanesProps {
  /** Lane keys to render in order. Hidden lanes are absent — the row
   * disappears entirely, and the canvas height shrinks to match. */
  readonly lanes: readonly LaneKey[];
}

/**
 * Lane row backgrounds + sticky lane labels.
 *
 * Each lane row spans the full canvas width (so the bottom hairline
 * crosses the entire timeline). Inside each row, the label sits in a
 * `position: sticky; left: 0` container so it stays pinned to the
 * viewport's left edge while the user pans/scrolls horizontally —
 * without it, the operator loses lane context as soon as they scroll
 * past the start.
 *
 * The sticky label's opaque background (var(--s1) — canvas color) is
 * critical: it must occlude nodes that scroll under it. Z-index sits
 * above default node circles but below hovered labels (which surface
 * extra detail).
 */
export function GraphLanes({ lanes }: GraphLanesProps) {
  return (
    <>
      {lanes.map((key, idx) => {
        const theme = laneThemeForKey(key);
        return (
          <div
            key={key}
            className="absolute border-b border-[var(--hair)]"
            style={{
              top: idx * LANE_HEIGHT,
              left: 0,
              right: 0,
              height: LANE_HEIGHT,
            }}
          >
            <div
              title={theme.description}
              style={{
                position: "sticky",
                left: 0,
                width: LANE_LABEL_WIDTH,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingLeft: 14,
                paddingRight: 8,
                background: "var(--s1)",
                borderRight: "1px solid var(--hair)",
                zIndex: 8,
                cursor: "help",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: theme.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: theme.color,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {theme.label}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Map LaneKey ↔ TimelineLane domain — `veri` doesn't exist on the
 * domain side, so we hardcode it. Keeps colors aligned with feed cards.
 * Descriptions are the same plain-English copy the sidebar's lane
 * filter uses — keep both in sync if the vocabulary shifts.
 */
function laneThemeForKey(
  key: string,
): { label: string; color: string; description: string } {
  const map: Record<
    string,
    {
      lane: Parameters<typeof laneThemeFor>[0] | null;
      veri: boolean;
      description: string;
    }
  > = {
    user: {
      lane: "user",
      veri: false,
      description: "User · prompts, replies, approvals",
    },
    plan: {
      lane: "planning",
      veri: false,
      description: "Plan · reasoning, intent, decisions",
    },
    expl: {
      lane: "exploration",
      veri: false,
      description: "Explore · file reads, greps, listings",
    },
    impl: {
      lane: "implementation",
      veri: false,
      description: "Implement · file writes, shell commands, edits",
    },
    rule: {
      lane: "rule",
      veri: false,
      description: "Rule · enforcement triggers and violations",
    },
    veri: {
      lane: null,
      veri: true,
      description: "Verify · validation runs, tests, lint checks",
    },
    coord: {
      lane: "coordination",
      veri: false,
      description: "Coord · sub-agent spawns and hand-offs",
    },
  };
  const entry = map[key];
  if (entry?.veri) {
    return { label: "VERI", color: "var(--ph-veri)", description: entry.description };
  }
  if (entry?.lane) {
    const t = laneThemeFor(entry.lane);
    return { label: t.label, color: t.cssColor, description: entry.description };
  }
  return {
    label: key.toUpperCase(),
    color: "var(--ink-tertiary)",
    description: "",
  };
}
