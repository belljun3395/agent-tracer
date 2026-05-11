import {
  ALL_VISIBLE_LANES,
  type VisibleLane,
} from "~state/ui/slices/viewSlice.js";
import {
  useSetVisibleLanes,
  useToggleVisibleLane,
  useVisibleLanes,
} from "~state/ui/index.js";

const LANE_LABEL: Readonly<Record<VisibleLane, string>> = {
  user: "USER",
  plan: "PLAN",
  expl: "EXPL",
  impl: "IMPL",
  rule: "RULE",
  veri: "VERI",
  coord: "COORD",
};

const LANE_DESCRIPTION: Readonly<Record<VisibleLane, string>> = {
  user: "User · prompts, replies, approvals",
  plan: "Plan · reasoning, intent, decisions",
  expl: "Explore · file reads, greps, listings",
  impl: "Implement · file writes, shell commands, edits",
  rule: "Rule · enforcement triggers and violations",
  veri: "Verify · validation runs, tests, lint checks",
  coord: "Coord · sub-agent spawns and hand-offs",
};

const LANE_COLOR: Readonly<Record<VisibleLane, string>> = {
  user: "var(--ph-user)",
  plan: "var(--ph-plan)",
  expl: "var(--ph-expl)",
  impl: "var(--ph-impl)",
  rule: "var(--ph-rule)",
  veri: "var(--ph-veri)",
  coord: "var(--ph-coord)",
};

/**
 * Pill-style toggles letting the operator hide lanes they're not
 * tracking right now (e.g. mute COORD when triaging IMPL noise).
 *
 * Visible state is stored in Zustand and persisted, so the choice
 * survives reload — the user shouldn't have to re-prune every session.
 * The slice prevents toggling the last visible lane off, so the chip
 * strip can never end up in an "everything hidden" dead-end.
 */
export function LaneFilter() {
  const visible = useVisibleLanes();
  const toggle = useToggleVisibleLane();
  const setVisibleLanes = useSetVisibleLanes();
  const visibleSet = new Set(visible);
  const allOn = visible.length === ALL_VISIBLE_LANES.length;

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
      }}
    >
      <span
        style={{
          color: "var(--ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginRight: 4,
        }}
      >
        Lanes
      </span>
      <button
        type="button"
        onClick={() => setVisibleLanes(ALL_VISIBLE_LANES)}
        aria-pressed={allOn}
        disabled={allOn}
        title={allOn ? "All lanes already visible" : "Show every lane"}
        style={{
          padding: "2px 10px",
          border: `1px solid ${allOn ? "var(--hair-strong)" : "var(--hair)"}`,
          borderRadius: "var(--radius-pill)",
          background: allOn ? "var(--s2)" : "transparent",
          color: allOn ? "var(--ink)" : "var(--ink-muted)",
          cursor: allOn ? "default" : "pointer",
          opacity: allOn ? 1 : 0.85,
          transition: "all 120ms",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        All
      </button>
      <span
        aria-hidden
        style={{
          width: 1,
          height: 14,
          background: "var(--hair)",
          marginInline: 2,
        }}
      />
      {ALL_VISIBLE_LANES.map((lane) => {
        const isOn = visibleSet.has(lane);
        return (
          <button
            key={lane}
            type="button"
            onClick={() => toggle(lane)}
            aria-pressed={isOn}
            title={LANE_DESCRIPTION[lane]}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 8px",
              border: `1px solid ${isOn ? "var(--hair-strong)" : "var(--hair)"}`,
              borderRadius: "var(--radius-pill)",
              background: isOn ? "var(--s2)" : "transparent",
              color: isOn ? "var(--ink)" : "var(--ink-tertiary)",
              cursor: "pointer",
              opacity: isOn ? 1 : 0.55,
              transition: "all 120ms",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: LANE_COLOR[lane],
                opacity: isOn ? 1 : 0.4,
              }}
            />
            {LANE_LABEL[lane]}
          </button>
        );
      })}
    </div>
  );
}
