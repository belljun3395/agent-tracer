import {
  CONTEXT_CHART_HEIGHT,
  CONTEXT_CHART_TOP,
  CONTEXT_ERROR_PERCENT,
  CONTEXT_WARN_PERCENT,
  areaPath,
  contextY,
  linePath,
  type ContextPlotPoint,
} from "~web/widgets/feed/graph/context/presentation.js";

interface ContextTrajectoryChartProps {
  readonly points: readonly ContextPlotPoint[];
  readonly stroke: string;
}

/** 컨텍스트 사용률과 경고 임계선을 SVG 곡선으로 그린다. */
export function ContextTrajectoryChart({
  points,
  stroke,
}: ContextTrajectoryChartProps) {
  return (
    <svg
      width="100%"
      height={CONTEXT_CHART_HEIGHT}
      viewBox={`0 0 100 ${CONTEXT_CHART_HEIGHT}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", top: CONTEXT_CHART_TOP, left: 0, right: 0 }}
    >
      <line
        x1={0}
        x2={100}
        y1={contextY(CONTEXT_WARN_PERCENT)}
        y2={contextY(CONTEXT_WARN_PERCENT)}
        stroke="var(--warn)"
        strokeWidth={0.6}
        strokeDasharray="0.7,1"
        opacity={0.4}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        x2={100}
        y1={contextY(CONTEXT_ERROR_PERCENT)}
        y2={contextY(CONTEXT_ERROR_PERCENT)}
        stroke="var(--err)"
        strokeWidth={0.6}
        strokeDasharray="0.7,1"
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {points.length >= 2 && (
        <>
          <path d={areaPath(points)} fill={stroke} opacity={0.16} />
          <path
            d={linePath(points)}
            fill="none"
            stroke={stroke}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
