import { useMemo } from "react";
import type { TrajectoryPoint } from "~web/widgets/feed/lib/extraction/extract-context-trajectory.js";

interface ContextSparklineProps {
  readonly points: readonly TrajectoryPoint[];
  /** 스파크라인의 픽셀 너비. */
  readonly width?: number;
  readonly height?: number;
}

const WARN_THRESHOLD = 85;
const ERR_THRESHOLD = 95;

/** 컨텍스트 윈도우가 시간에 따라 얼마나 찼는지 보여주는 작은 인라인 SVG. 렌더링 선택: - x축은 절대 시간이 아니라 정규화된 시간(첫 샘플부터 마지막까지 0..1)이다. */
export function ContextSparkline({
  points,
  width = 240,
  height = 36,
}: ContextSparklineProps) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const minT = points[0]!.atMs;
    const maxT = points[points.length - 1]!.atMs;
    const span = Math.max(1, maxT - minT);
    return points
      .map((p, i) => {
        const x = ((p.atMs - minT) / span) * width;
        const y = height - (Math.min(100, p.percent) / 100) * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, width, height]);

  if (!path) return null;

  const last = points[points.length - 1]!;
  const stroke =
    last.percent >= ERR_THRESHOLD
      ? "var(--err)"
      : last.percent >= WARN_THRESHOLD
        ? "var(--warn)"
        : "var(--primary)";

  return (
    <svg
      role="img"
      aria-label={`Context trajectory, latest ${Math.round(last.percent)}%`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
    >
      <line
        x1={0}
        x2={width}
        y1={height - (WARN_THRESHOLD / 100) * height}
        y2={height - (WARN_THRESHOLD / 100) * height}
        stroke="var(--warn)"
        strokeWidth={1}
        strokeDasharray="2,3"
        opacity={0.35}
      />
      <line
        x1={0}
        x2={width}
        y1={height - (ERR_THRESHOLD / 100) * height}
        y2={height - (ERR_THRESHOLD / 100) * height}
        stroke="var(--err)"
        strokeWidth={1}
        strokeDasharray="2,3"
        opacity={0.4}
      />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.6} />
    </svg>
  );
}
