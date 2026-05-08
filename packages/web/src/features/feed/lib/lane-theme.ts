import type { TimelineEventRecord, TimelineLane } from "~domain/monitoring.js";

/*
 * Lane mapping — translates the backend's 10-lane domain into v6's 7 visual
 * lanes. A two-step decision:
 *
 *   1. `event.kind === 'verification.logged'` always wins — those events
 *      render in the green VERI lane regardless of the domain classifier's
 *      verdict. (See plan §VERI 어댑터.)
 *   2. Otherwise the lane name is mapped via LANE_TO_KEY.
 *
 * Domain types are NOT mutated — this stays an adapter so backend changes
 * don't ripple into the UI's color taxonomy.
 */
export type LaneKey =
  | "user"
  | "plan"
  | "expl"
  | "impl"
  | "rule"
  | "veri"
  | "coord"
  | "bg";

export interface LaneTheme {
  readonly key: LaneKey;
  /** UPPERCASE micro-label rendered in card heads. */
  readonly label: string;
  /** CSS color expression, ready for `color` / `background` properties. */
  readonly cssColor: string;
}

const LANE_TO_KEY: Record<TimelineLane, LaneKey> = {
  user: "user",
  exploration: "expl",
  planning: "plan",
  implementation: "impl",
  rule: "rule",
  questions: "rule",
  todos: "plan",
  background: "bg",
  coordination: "coord",
  telemetry: "bg",
};

const KEY_TO_LABEL: Record<LaneKey, string> = {
  user: "USER",
  plan: "PLAN",
  expl: "EXPL",
  impl: "IMPL",
  rule: "RULE",
  veri: "VERI",
  coord: "COORD",
  bg: "BG",
};

const KEY_TO_VAR: Record<LaneKey, string> = {
  user: "var(--ph-user)",
  plan: "var(--ph-plan)",
  expl: "var(--ph-expl)",
  impl: "var(--ph-impl)",
  rule: "var(--ph-rule)",
  veri: "var(--ph-veri)",
  coord: "var(--ph-coord)",
  bg: "var(--ink-subtle)",
};

export function laneThemeForEvent(event: TimelineEventRecord): LaneTheme {
  const key: LaneKey =
    event.kind === "verification.logged" ? "veri" : LANE_TO_KEY[event.lane];
  return {
    key,
    label: KEY_TO_LABEL[key],
    cssColor: KEY_TO_VAR[key],
  };
}

export function laneThemeFor(lane: TimelineLane): LaneTheme {
  const key = LANE_TO_KEY[lane];
  return { key, label: KEY_TO_LABEL[key], cssColor: KEY_TO_VAR[key] };
}
