export const CONTEXT_STRIP_HEIGHT = 60;
export const CONTEXT_CHART_TOP = 6;
export const MODEL_BAND_HEIGHT = 14;
export const CONTEXT_CHART_HEIGHT =
  CONTEXT_STRIP_HEIGHT - CONTEXT_CHART_TOP - MODEL_BAND_HEIGHT;
export const CONTEXT_WARN_PERCENT = 85;
export const CONTEXT_ERROR_PERCENT = 95;

export interface ContextPlotPoint {
  readonly leftPercent: number;
  readonly percent: number;
}

export function contextStroke(percent: number | undefined): string {
  if (percent === undefined) return "var(--primary)";
  if (percent >= CONTEXT_ERROR_PERCENT) return "var(--err)";
  if (percent >= CONTEXT_WARN_PERCENT) return "var(--warn)";
  return "var(--primary)";
}

export function contextY(percent: number): number {
  return CONTEXT_CHART_HEIGHT - (percent / 100) * CONTEXT_CHART_HEIGHT;
}

export function linePath(points: readonly ContextPlotPoint[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.leftPercent.toFixed(2)} ${contextY(point.percent).toFixed(2)}`,
    )
    .join(" ");
}

export function areaPath(points: readonly ContextPlotPoint[]): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L ${last.leftPercent.toFixed(2)} ${CONTEXT_CHART_HEIGHT} L ${first.leftPercent.toFixed(2)} ${CONTEXT_CHART_HEIGHT} Z`;
}

export function modelFamilyColor(label: string): string {
  switch (label) {
    case "Opus":
      return "#8b5cf6";
    case "Sonnet":
      return "#14b8a6";
    case "Haiku":
      return "#84cc16";
    default:
      return "var(--ink-tertiary)";
  }
}

export function dedupeModelLabels(
  spans: readonly { readonly label: string }[],
): readonly string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const span of spans) {
    if (seen.has(span.label)) continue;
    seen.add(span.label);
    labels.push(span.label);
  }
  return labels;
}
