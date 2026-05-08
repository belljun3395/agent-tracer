import { useMemo } from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { buildContextTrajectory } from "~features/feed/lib/extract-context-trajectory.js";
import { buildModelSpans } from "~features/feed/lib/extract-model-spans.js";
import { msToLeftPercent, type TimeRange } from "./lib/time-range.js";
import { LANE_LABEL_WIDTH, TRACK_LEFT_PADDING } from "./lib/layout.js";

interface GraphContextStripProps {
  readonly events: readonly TimelineEventRecord[];
  readonly range: TimeRange;
}

const STRIP_HEIGHT = 60;
const PAD_TOP = 6;
const PAD_BOTTOM = 14;
const CHART_HEIGHT = STRIP_HEIGHT - PAD_TOP - PAD_BOTTOM;
const WARN_PCT = 85;
const ERR_PCT = 95;

/**
 * Time-aligned context-window curve rendered immediately below the
 * graph's lane area. Shares the same `range`, the same gutter math
 * (LANE_LABEL_WIDTH + TRACK_LEFT_PADDING), and the same SVG
 * preserve-aspect-ratio strategy so the curve's x positions land on
 * the same vertical lines as the nodes above.
 *
 * Visual layers, bottom to top:
 *
 *   1. Hairline baseline
 *   2. Threshold lines at 85% (warn) and 95% (err) — dashed, low alpha
 *   3. Filled area beneath the curve, faded to suggest density
 *   4. Stroke on top of the area (warn/err tint at the latest sample)
 *   5. Model bands at the bottom edge — small coloured stripe per
 *      family (Opus / Sonnet / GPT-4o etc.) so the operator can see
 *      "this run started on Sonnet, switched to Opus mid-way".
 *
 * Renders nothing when no trajectory exists — keeps the graph compact
 * for runtimes that don't report context usage.
 */
export function GraphContextStrip({ events, range }: GraphContextStripProps) {
  const trajectory = useMemo(
    () => buildContextTrajectory(events),
    [events],
  );
  const modelSpans = useMemo(() => buildModelSpans(events), [events]);

  if (trajectory.length === 0 && modelSpans.length === 0) return null;

  const points = trajectory.map((p) => ({
    leftPercent: msToLeftPercent(p.atMs, range),
    pct: Math.min(100, p.percent),
  }));

  const last = trajectory[trajectory.length - 1];
  const stroke =
    last == null
      ? "var(--primary)"
      : last.percent >= ERR_PCT
        ? "var(--err)"
        : last.percent >= WARN_PCT
          ? "var(--warn)"
          : "var(--primary)";

  const yForPct = (pct: number) => CHART_HEIGHT - (pct / 100) * CHART_HEIGHT;

  return (
    <div
      className="relative"
      style={{
        height: STRIP_HEIGHT,
        borderTop: "1px solid var(--hair)",
        background: "var(--canvas)",
      }}
    >
      {/* Lane-label gutter mirror — keeps the strip's left column
          aligned with the lane-label column above. */}
      <div
        style={{
          position: "sticky",
          left: 0,
          top: 0,
          width: LANE_LABEL_WIDTH,
          height: "100%",
          float: "left",
          background: "var(--s1)",
          borderRight: "1px solid var(--hair)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-tertiary)",
          zIndex: 8,
          pointerEvents: "none",
        }}
      >
        Context
      </div>

      <div
        style={{
          marginLeft: LANE_LABEL_WIDTH + TRACK_LEFT_PADDING,
          height: "100%",
          position: "relative",
        }}
      >
        <svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", top: PAD_TOP, left: 0, right: 0 }}
        >
          <line
            x1={0}
            x2={100}
            y1={yForPct(WARN_PCT)}
            y2={yForPct(WARN_PCT)}
            stroke="var(--warn)"
            strokeWidth={0.6}
            strokeDasharray="0.7,1"
            opacity={0.4}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            x2={100}
            y1={yForPct(ERR_PCT)}
            y2={yForPct(ERR_PCT)}
            stroke="var(--err)"
            strokeWidth={0.6}
            strokeDasharray="0.7,1"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {points.length >= 2 && (
            <>
              <path
                d={areaPath(points, yForPct)}
                fill={stroke}
                opacity={0.16}
              />
              <path
                d={linePath(points, yForPct)}
                fill="none"
                stroke={stroke}
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Model bands at the bottom edge */}
        {modelSpans.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: PAD_BOTTOM,
              display: "flex",
              alignItems: "center",
            }}
          >
            {modelSpans.map((span, idx) => {
              const startPct = msToLeftPercent(span.startMs, range);
              const endPct = msToLeftPercent(span.endMs, range);
              const widthPct = Math.max(0.5, endPct - startPct);
              return (
                <div
                  key={`${span.modelId}-${idx}`}
                  title={span.modelId}
                  style={{
                    position: "absolute",
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    height: 8,
                    background: modelFamilyColor(span.label),
                    opacity: 0.55,
                    borderRadius: 2,
                  }}
                />
              );
            })}
            {/* Model label legend — list of families in order of
                appearance, in case the band is too thin to read. */}
            <div
              style={{
                position: "relative",
                marginLeft: "auto",
                paddingRight: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "var(--ink-tertiary)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {dedupeLabels(modelSpans).join(" → ")}
            </div>
          </div>
        )}

        {/* Latest-percent badge in the top-right */}
        {last && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              padding: "1px 6px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 500,
              color: stroke,
              background: "var(--canvas)",
              border: `1px solid color-mix(in srgb, ${stroke} 40%, transparent)`,
              borderRadius: 2,
            }}
          >
            {Math.round(last.percent)}%
          </div>
        )}
      </div>
    </div>
  );
}

interface Pt {
  readonly leftPercent: number;
  readonly pct: number;
}

function linePath(points: readonly Pt[], yForPct: (pct: number) => number): string {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.leftPercent.toFixed(2)} ${yForPct(p.pct).toFixed(2)}`,
    )
    .join(" ");
}

function areaPath(points: readonly Pt[], yForPct: (pct: number) => number): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const top = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.leftPercent.toFixed(2)} ${yForPct(p.pct).toFixed(2)}`,
    )
    .join(" ");
  return `${top} L ${last.leftPercent.toFixed(2)} ${CHART_HEIGHT} L ${first.leftPercent.toFixed(2)} ${CHART_HEIGHT} Z`;
}

function modelFamilyColor(label: string): string {
  switch (label) {
    case "Opus":
      return "#8b5cf6";
    case "Sonnet":
      return "#14b8a6";
    case "Haiku":
      return "#84cc16";
    case "GPT-4o":
    case "GPT-4":
    case "GPT-5":
      return "#6b7280";
    case "Codex":
      return "#10b981";
    case "o1":
    case "o3":
      return "#ea580c";
    default:
      return "var(--ink-tertiary)";
  }
}

function dedupeLabels(spans: readonly { readonly label: string }[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of spans) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    out.push(s.label);
  }
  return out;
}
