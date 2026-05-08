import { useMemo } from "react";
import type { TrajectoryPoint } from "./lib/extract-context-trajectory.js";

interface ContextSparklineProps {
  readonly points: readonly TrajectoryPoint[];
  /** Pixel width of the sparkline; height is fixed for visual rhythm. */
  readonly width?: number;
  readonly height?: number;
}

const WARN_THRESHOLD = 85;
const ERR_THRESHOLD = 95;

/**
 * Tiny inline SVG showing how the context window filled up over time.
 *
 * Rendering choices:
 *   - X axis is normalised time (0..1 from first to last sample), not
 *     absolute time. The shape of the curve matters more than the
 *     wall-clock spacing, and a uniform x scale stops short bursts
 *     from collapsing to a single point.
 *   - Y axis is a fixed 0..100% scale so the curve is comparable
 *     across tasks and reads at a glance — "almost full" looks the
 *     same whether the limit is 100k or 200k tokens.
 *   - Threshold lines at 85% / 95% (warn / err) are drawn first so
 *     the curve sits over them, not the other way around.
 *
 * Renders nothing when there's only one sample (no trajectory to draw).
 */
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
      style={{ display: "block" }}
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
