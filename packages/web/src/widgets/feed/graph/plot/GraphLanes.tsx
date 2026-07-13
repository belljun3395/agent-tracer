import { laneThemeFor, type LaneKey } from "~web/entities/task/model/lane-theme.js";
import type { GuidanceCatalog } from "~web/shared/guidance.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import type { GraphLaneKey } from "~web/widgets/feed/graph/model/node-layout.js";
import { LANE_HEIGHT, LANE_LABEL_WIDTH } from "~web/widgets/feed/graph/model/track-geometry.js";

interface GraphLanesProps {
  /** 순서대로 렌더링할 레인 키. */
  readonly lanes: readonly LaneKey[];
}

/** 레인 행 배경 + 고정 레인 라벨. */
export function GraphLanes({ lanes }: GraphLanesProps) {
  const guidance = useGuidance();
  return (
    <>
      {lanes.map((key, idx) => {
        const theme = laneThemeForKey(key);
        return (
          <div
            key={key}
            className="absolute border-b border-hair left-0 right-0"
            style={{ top: idx * LANE_HEIGHT, height: LANE_HEIGHT }}
          >
            <Tooltip
              content={
                theme.guidanceKey === null ? null : (
                  <GuidanceText
                    locale={guidance.locale}
                    message={guidance.messages.feed.lanes[theme.guidanceKey]}
                  />
                )
              }
            >
              <div
                className="sticky left-0 h-full flex items-center gap-2 pl-3.5 pr-2 bg-s1 border-r border-hair z-[8] cursor-help"
                style={{ width: LANE_LABEL_WIDTH }}
              >
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: theme.color }}
                />
                <span
                  className="font-mono text-[10px] tracking-[0.1em] uppercase whitespace-nowrap"
                  style={{ color: theme.color }}
                >
                  {theme.label}
                </span>
              </div>
            </Tooltip>
          </div>
        );
      })}
    </>
  );
}

// `veri`는 타임라인 레인 도메인에 대응이 없어 그래프 전용 레인으로만 존재한다.
function laneThemeForKey(
  key: string,
): { label: string; color: string; guidanceKey: LaneDescription | null } {
  const map: Record<
    GraphLaneKey,
    {
      lane: Parameters<typeof laneThemeFor>[0] | null;
      veri: boolean;
      guidanceKey: LaneDescription;
    }
  > = {
    user: {
      lane: "user",
      veri: false,
      guidanceKey: "user",
    },
    plan: {
      lane: "planning",
      veri: false,
      guidanceKey: "plan",
    },
    expl: {
      lane: "exploration",
      veri: false,
      guidanceKey: "explore",
    },
    impl: {
      lane: "implementation",
      veri: false,
      guidanceKey: "implement",
    },
    rule: {
      lane: "rule",
      veri: false,
      guidanceKey: "rule",
    },
    veri: {
      lane: null,
      veri: true,
      guidanceKey: "verify",
    },
    coord: {
      lane: "coordination",
      veri: false,
      guidanceKey: "coordinate",
    },
  };
  const entry = map[key as GraphLaneKey] as (typeof map)[GraphLaneKey] | undefined;
  if (entry?.veri) {
    return { label: "VERI", color: "var(--ph-veri)", guidanceKey: entry.guidanceKey };
  }
  if (entry?.lane) {
    const t = laneThemeFor(entry.lane);
    return { label: t.label, color: t.cssColor, guidanceKey: entry.guidanceKey };
  }
  return {
    label: key.toUpperCase(),
    color: "var(--ink-tertiary)",
    guidanceKey: null,
  };
}

type LaneDescription = keyof GuidanceCatalog["feed"]["lanes"];
