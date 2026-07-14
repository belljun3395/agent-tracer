import { KIND } from "@monitor/kernel";
import type { TimelineEventRecord, TimelineLane } from "~web/entities/task/model/timeline/event.js";

export type LaneKey =
  | "user"
  | "asst"
  | "plan"
  | "expl"
  | "impl"
  | "rule"
  | "veri"
  | "coord"
  | "bg";

export interface LaneTheme {
  readonly key: LaneKey;
  readonly label: string;
  readonly cssColor: string;
}

const LANE_TO_KEY: Readonly<Record<TimelineLane, LaneKey>> = {
  user: "user",
  assistant: "asst",
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

const KEY_TO_LABEL: Readonly<Record<LaneKey, string>> = {
  user: "USER",
  asst: "ASST",
  plan: "PLAN",
  expl: "EXPL",
  impl: "IMPL",
  rule: "RULE",
  veri: "VERI",
  coord: "COORD",
  bg: "BG",
};

const KEY_TO_VAR: Readonly<Record<LaneKey, string>> = {
  user: "var(--ph-user)",
  asst: "var(--ph-asst)",
  plan: "var(--ph-plan)",
  expl: "var(--ph-expl)",
  impl: "var(--ph-impl)",
  rule: "var(--ph-rule)",
  veri: "var(--ph-veri)",
  coord: "var(--ph-coord)",
  bg: "var(--ink-subtle)",
};

/** 이벤트 도메인 분류를 화면 레인 테마로 투영한다. */
export function laneThemeForEvent(event: TimelineEventRecord): LaneTheme {
  const key = event.kind === KIND.verificationLogged
    ? "veri"
    : LANE_TO_KEY[event.lane];
  return laneThemeForKey(key);
}

export function laneThemeForKey(key: LaneKey): LaneTheme {
  return { key, label: KEY_TO_LABEL[key], cssColor: KEY_TO_VAR[key] };
}

export function laneThemeFor(lane: TimelineLane): LaneTheme {
  return laneThemeForKey(LANE_TO_KEY[lane]);
}
