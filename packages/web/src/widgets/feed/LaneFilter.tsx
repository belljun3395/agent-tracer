import {
  ALL_VISIBLE_LANES,
  type VisibleLane,
} from "~web/shared/store/slices/viewSlice.js";
import {
  useGuidance,
  useSetVisibleLanes,
  useToggleVisibleLane,
  useVisibleLanes,
} from "~web/shared/store/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";

const LANE_LABEL: Readonly<Record<VisibleLane, string>> = {
  user: "USER",
  plan: "PLAN",
  expl: "EXPL",
  impl: "IMPL",
  rule: "RULE",
  veri: "VERI",
  coord: "COORD",
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

/** 지금 추적하지 않는 레인을 숨길 수 있는 필 형태 토글이다(예: IMPL 노이즈를 정리할 때 COORD를 끈다). */
export function LaneFilter() {
  const guidance = useGuidance();
  const visible = useVisibleLanes();
  const toggle = useToggleVisibleLane();
  const setVisibleLanes = useSetVisibleLanes();
  const visibleSet = new Set(visible);
  const allOn = visible.length === ALL_VISIBLE_LANES.length;

  return (
    <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
      <span className="text-ink-tertiary uppercase tracking-[0.1em] mr-1">
        Lanes
      </span>
      <button
        type="button"
        onClick={() => setVisibleLanes(ALL_VISIBLE_LANES)}
        aria-pressed={allOn}
        disabled={allOn}
        className={cn(
          "py-0.5 px-2.5 rounded-pill transition-all duration-[120ms] uppercase tracking-[0.06em] border",
          allOn
            ? "border-hair-strong bg-s2 text-ink cursor-default opacity-100"
            : "border-hair bg-transparent text-ink-muted cursor-pointer opacity-85",
        )}
      >
        All
      </button>
      <span aria-hidden className="w-px h-3.5 bg-hair mx-0.5" />
      {ALL_VISIBLE_LANES.map((lane) => {
        const isOn = visibleSet.has(lane);
        return (
          <Tooltip
            key={lane}
            content={
              <GuidanceText
                locale={guidance.locale}
                message={guidance.messages.feed.lanes[laneGuidanceKey(lane)]}
              />
            }
          >
            <button
              type="button"
              onClick={() => toggle(lane)}
              aria-pressed={isOn}
              className={cn(
                "inline-flex items-center gap-1 py-0.5 px-2 rounded-pill cursor-pointer transition-all duration-[120ms] border",
                isOn
                  ? "border-hair-strong bg-s2 text-ink opacity-100"
                  : "border-hair bg-transparent text-ink-tertiary opacity-55",
              )}
            >
              <span
                aria-hidden
                className={cn("w-[7px] h-[7px] rounded-full", isOn ? "opacity-100" : "opacity-40")}
                style={{ background: LANE_COLOR[lane] }}
              />
              {LANE_LABEL[lane]}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function laneGuidanceKey(lane: VisibleLane) {
  return lane === "expl"
    ? "explore"
    : lane === "impl"
      ? "implement"
      : lane === "veri"
        ? "verify"
        : lane === "coord"
          ? "coordinate"
          : lane;
}
