import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { TimelineItemLayout } from "../../../types.js";
import type { ContextWarningPrefs } from "../../lib/contextWarningPrefs.js";

export interface ContextChartProps {
    readonly timelineWidth: number;
    readonly allItems: readonly TimelineItemLayout[];
    readonly snapshotItems: readonly TimelineItemLayout[];
    readonly compactItems: readonly TimelineItemLayout[];
    readonly contextWarningPrefs: ContextWarningPrefs;
}

interface CompactMarker {
    readonly x: number;
    readonly phase: string;
}

const GAP_THRESHOLD_RATIO = 0.10;
const GAP_DISPLAY_FRACTION = 0.03;
const CHART_HEIGHT = 28;
const PADDING_TOP = 4;
const PADDING_BOTTOM = 4;
const INNER_H = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const MODEL_BAR_HEIGHT = 18;

interface Segment {
    readonly realStart: number;
    readonly realEnd: number;
    readonly mapStart: number;
    readonly mapEnd: number;
    readonly isGap: boolean;
}

function buildSegments(sortedLefts: readonly number[], totalWidth: number): readonly Segment[] {
    if (totalWidth === 0) return [];
    const threshold = totalWidth * GAP_THRESHOLD_RATIO;
    const gaps: Array<[number, number]> = [];
    for (let i = 0; i < sortedLefts.length - 1; i++) {
        const gap = (sortedLefts[i + 1] ?? 0) - (sortedLefts[i] ?? 0);
        if (gap > threshold) gaps.push([sortedLefts[i] ?? 0, sortedLefts[i + 1] ?? 0]);
    }
    if (gaps.length === 0) {
        return [{ realStart: 0, realEnd: totalWidth, mapStart: 0, mapEnd: 1, isGap: false }];
    }
    const raw: Array<{ start: number; end: number; isGap: boolean }> = [];
    let cursor = 0;
    for (const [gs, ge] of gaps) {
        if (cursor < gs) raw.push({ start: cursor, end: gs, isGap: false });
        raw.push({ start: gs, end: ge, isGap: true });
        cursor = ge;
    }
    if (cursor < totalWidth) raw.push({ start: cursor, end: totalWidth, isGap: false });
    const totalContent = raw.filter(s => !s.isGap).reduce((s, seg) => s + (seg.end - seg.start), 0);
    const contentDisplay = Math.max(0.01, 1 - gaps.length * GAP_DISPLAY_FRACTION);
    const result: Segment[] = [];
    let mc = 0;
    for (const seg of raw) {
        const rl = seg.end - seg.start;
        const ml = seg.isGap ? GAP_DISPLAY_FRACTION : (rl / Math.max(1, totalContent)) * contentDisplay;
        result.push({ realStart: seg.start, realEnd: seg.end, mapStart: mc, mapEnd: mc + ml, isGap: seg.isGap });
        mc += ml;
    }
    return result;
}

function realToX(realPx: number, segments: readonly Segment[], chartWidth: number): number {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (realPx <= seg.realEnd || i === segments.length - 1) {
            const span = seg.realEnd - seg.realStart;
            const t = span > 0 ? (realPx - seg.realStart) / span : 0;
            return (seg.mapStart + t * (seg.mapEnd - seg.mapStart)) * chartWidth;
        }
    }
    return chartWidth;
}

interface DataPoint {
    readonly x: number;
    readonly pct: number;
}

function buildPoints(
    snapshotItems: readonly TimelineItemLayout[],
    metaKey: string,
    segments: readonly Segment[],
    chartWidth: number,
): readonly DataPoint[] {
    const pts: DataPoint[] = [];
    for (const item of snapshotItems) {
        const meta = item.event.metadata;
        const raw = meta[metaKey];
        if (typeof raw !== "number") continue;
        const pct = Math.max(0, Math.min(100, raw));
        pts.push({ x: realToX(item.left, segments, chartWidth), pct });
    }
    return pts.sort((a, b) => a.x - b.x);
}

function buildAreaPath(points: readonly DataPoint[], h: number): string {
    if (points.length === 0) return "";
    const toY = (pct: number): number => PADDING_TOP + INNER_H - (pct / 100) * INNER_H;
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let d = `M ${first.x} ${toY(first.pct)}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i]!.x} ${toY(points[i]!.pct)}`;
    }
    d += ` L ${last.x} ${h - PADDING_BOTTOM} L ${first.x} ${h - PADDING_BOTTOM} Z`;
    return d;
}

function buildLinePath(points: readonly DataPoint[]): string {
    if (points.length === 0) return "";
    const toY = (pct: number): number => PADDING_TOP + INNER_H - (pct / 100) * INNER_H;
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${toY(p.pct)}`).join(" ");
}

function buildThresholdAreaPath(points: readonly DataPoint[], thresholdPct: number): string {
    if (points.length < 2) return "";
    const toY = (pct: number): number => PADDING_TOP + INNER_H - (pct / 100) * INNER_H;
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let d = `M ${first.x} ${toY(first.pct)}`;
    for (let index = 1; index < points.length; index++) {
        d += ` L ${points[index]!.x} ${toY(points[index]!.pct)}`;
    }
    d += ` L ${last.x} ${toY(thresholdPct)} L ${first.x} ${toY(thresholdPct)} Z`;
    return d;
}

function interpolatePoint(a: DataPoint, b: DataPoint, thresholdPct: number): DataPoint {
    if (a.pct === b.pct) return { x: b.x, pct: thresholdPct };
    const ratio = (thresholdPct - a.pct) / (b.pct - a.pct);
    return {
        x: a.x + ((b.x - a.x) * ratio),
        pct: thresholdPct,
    };
}

function splitLineByThreshold(
    points: readonly DataPoint[],
    thresholdPct: number,
): { readonly normal: readonly DataPoint[][]; readonly warning: readonly DataPoint[][] } {
    if (points.length < 2) return { normal: [], warning: [] };
    const normal: DataPoint[][] = [];
    const warning: DataPoint[][] = [];
    let activeNormal: DataPoint[] = [];
    let activeWarning: DataPoint[] = [];
    const flushNormal = (): void => {
        if (activeNormal.length >= 2) normal.push(activeNormal);
        activeNormal = [];
    };
    const flushWarning = (): void => {
        if (activeWarning.length >= 2) warning.push(activeWarning);
        activeWarning = [];
    };

    for (let index = 0; index < points.length - 1; index++) {
        const start = points[index]!;
        const end = points[index + 1]!;
        const startWarn = start.pct >= thresholdPct;
        const endWarn = end.pct >= thresholdPct;

        if (startWarn === endWarn) {
            if (startWarn) {
                if (activeWarning.length === 0) activeWarning.push(start);
                activeWarning.push(end);
            } else {
                if (activeNormal.length === 0) activeNormal.push(start);
                activeNormal.push(end);
            }
            continue;
        }

        const crossing = interpolatePoint(start, end, thresholdPct);
        if (startWarn) {
            if (activeWarning.length === 0) activeWarning.push(start);
            activeWarning.push(crossing);
            flushWarning();
            activeNormal = [crossing, end];
        } else {
            if (activeNormal.length === 0) activeNormal.push(start);
            activeNormal.push(crossing);
            flushNormal();
            activeWarning = [crossing, end];
        }
    }

    flushNormal();
    flushWarning();
    return { normal, warning };
}

function shortenModelId(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.includes("opus")) return "Opus";
    if (lower.includes("sonnet")) return "Sonnet";
    if (lower.includes("haiku")) return "Haiku";
    const parts = modelId.split("-");
    return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : modelId;
}

interface ModelSpan {
    readonly x: number;
    readonly endX: number;
    readonly modelId: string;
    readonly label: string;
}

function modelFamilyColor(label: string): string {
    switch (label) {
        case "Opus": return "#8b5cf6";
        case "Sonnet": return "#14b8a6";
        case "Haiku": return "#84cc16";
        default: return "var(--text-secondary)";
    }
}

function buildModelSpans(
    snapshotItems: readonly TimelineItemLayout[],
    segments: readonly Segment[],
    chartWidth: number,
): readonly ModelSpan[] {
    const sorted = [...snapshotItems]
        .sort((a, b) => a.left - b.left)
        .filter(item => {
            const meta = item.event.metadata;
            return typeof meta["modelId"] === "string";
        });
    if (sorted.length === 0) return [];

    const spans: ModelSpan[] = [];
    let i = 0;
    while (i < sorted.length) {
        const current = sorted[i]!;
        const meta = current.event.metadata;
        const modelId = meta["modelId"] as string;
        const label = shortenModelId(modelId);
        const startX = realToX(current.left, segments, chartWidth);
        let j = i + 1;
        while (j < sorted.length) {
            const nextMeta = sorted[j]!.event.metadata;
            const nextLabel = shortenModelId(nextMeta["modelId"] as string);
            if (nextLabel !== label) break;
            j++;
        }
        const endX = j < sorted.length
            ? realToX(sorted[j]!.left, segments, chartWidth)
            : chartWidth;
        spans.push({ x: startX, endX, modelId, label });
        i = j;
    }
    return spans;
}

interface ChartRowProps {
    readonly points: readonly DataPoint[];
    readonly chartWidth: number;
    readonly label: string;
    readonly fillId: string;
    readonly strokeColor: string;
    readonly fillColor: string;
    readonly fillOpacity: number;
    readonly labelColor: string;
    readonly modelChangeXs: readonly number[];
    readonly compactMarkers: readonly CompactMarker[];
    readonly hoverSvgX: number | null;
    readonly onHoverChange: (svgX: number | null) => void;
    readonly contextWarningPrefs: ContextWarningPrefs;
}

function ChartRow({ points, chartWidth, label, fillId, strokeColor, fillColor, fillOpacity, labelColor, modelChangeXs, compactMarkers, hoverSvgX, onHoverChange, contextWarningPrefs }: ChartRowProps): React.JSX.Element {
    const latestPct = points.length > 0 ? points[points.length - 1]!.pct : null;
    const areaPath = buildAreaPath(points, CHART_HEIGHT);
    const linePath = buildLinePath(points);
    const midY = PADDING_TOP + INNER_H / 2;
    const svgWrapRef = useRef<HTMLDivElement>(null);
    const thresholdSegments = useMemo(
        () => contextWarningPrefs.enabled
            ? splitLineByThreshold(points, contextWarningPrefs.thresholdPct)
            : { normal: [], warning: [] },
        [contextWarningPrefs, points],
    );
    const thresholdY = PADDING_TOP + INNER_H - ((contextWarningPrefs.thresholdPct / 100) * INNER_H);
    const effectiveLabelColor = latestPct !== null && contextWarningPrefs.enabled && latestPct >= contextWarningPrefs.thresholdPct
        ? "var(--warn)"
        : labelColor;

    const handleMouseMove = useCallback((clientX: number): void => {
        const el = svgWrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onHoverChange(ratio * chartWidth);
    }, [chartWidth, onHoverChange]);

    const hoverPct = useMemo(() => {
        if (hoverSvgX === null || points.length === 0) return null;
        let nearest = points[0]!;
        let minDist = Math.abs(nearest.x - hoverSvgX);
        for (const p of points) {
            const d = Math.abs(p.x - hoverSvgX);
            if (d < minDist) { minDist = d; nearest = p; }
        }
        return { svgX: nearest.x, pct: nearest.pct };
    }, [hoverSvgX, points]);

    return (
        <div className="timeline-context-chart-row">
            <div className="timeline-context-chart-label" style={{ color: effectiveLabelColor }}>
                <span>{label}</span>
                <span className="timeline-context-chart-pct">
                    {hoverPct !== null ? `${Math.round(hoverPct.pct)}%` : latestPct !== null ? `${Math.round(latestPct)}%` : ""}
                </span>
            </div>
            <div
                ref={svgWrapRef}
                className="timeline-context-chart-svg-wrap"
                onMouseMove={(e) => handleMouseMove(e.clientX)}
                onMouseLeave={() => onHoverChange(null)}
            >
                <svg
                    width="100%"
                    height={CHART_HEIGHT}
                    viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={fillColor} stopOpacity={fillOpacity} />
                            <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    {/* baseline */}
                    <line x1={0} y1={CHART_HEIGHT - PADDING_BOTTOM} x2={chartWidth} y2={CHART_HEIGHT - PADDING_BOTTOM}
                        stroke="var(--border)" strokeWidth={0.5} />
                    {/* 50% guide */}
                    <line x1={0} y1={midY} x2={chartWidth} y2={midY}
                        stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
                    {contextWarningPrefs.enabled && (
                        <line
                            x1={0}
                            y1={thresholdY}
                            x2={chartWidth}
                            y2={thresholdY}
                            stroke="var(--warn)"
                            strokeWidth={0.75}
                            strokeDasharray="2 3"
                            opacity={0.75}
                        />
                    )}
                    {/* model change markers */}
                    {modelChangeXs.map((x, i) => (
                        <g key={`m-${i}`}>
                            <line x1={x} y1={0} x2={x} y2={CHART_HEIGHT}
                                stroke="#64748b" strokeWidth={1.25} strokeDasharray="4 2" opacity={0.9} />
                            <rect x={x - 3} y={0} width={6} height={4} fill="#64748b" opacity={0.95} rx={0.5} />
                        </g>
                    ))}
                    {/* compact markers (before-phase is the canonical boundary) */}
                    {compactMarkers.filter(m => m.phase === "before").map((m, i) => (
                        <g key={`c-${i}`}>
                            <rect
                                x={m.x - 3}
                                y={0}
                                width={6}
                                height={CHART_HEIGHT}
                                fill="#f59e0b"
                                opacity={0.85}
                            />
                            <polygon
                                points={`${m.x - 8},0 ${m.x + 8},0 ${m.x},11`}
                                fill="#f59e0b"
                                opacity={1}
                            />
                        </g>
                    ))}
                    {areaPath && (
                        <path d={areaPath} fill={`url(#${fillId})`} />
                    )}
                    {thresholdSegments.warning.map((segment, index) => (
                        <path
                            key={`fill-warning-${index}`}
                            d={buildThresholdAreaPath(segment, contextWarningPrefs.thresholdPct)}
                            fill="var(--warn)"
                            opacity={0.16}
                        />
                    ))}
                    {linePath && !contextWarningPrefs.enabled && (
                        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5}
                            strokeLinejoin="round" strokeLinecap="round" />
                    )}
                    {thresholdSegments.normal.map((segment, index) => (
                        <path
                            key={`line-normal-${index}`}
                            d={buildLinePath(segment)}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={1.75}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    ))}
                    {thresholdSegments.warning.map((segment, index) => (
                        <path
                            key={`line-warning-${index}`}
                            d={buildLinePath(segment)}
                            fill="none"
                            stroke="var(--warn)"
                            strokeWidth={1.85}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    ))}
                    {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={PADDING_TOP + INNER_H - (p.pct / 100) * INNER_H}
                            r={2.5}
                            fill={contextWarningPrefs.enabled && p.pct >= contextWarningPrefs.thresholdPct ? "var(--warn)" : strokeColor}
                            opacity={0.95}
                        />
                    ))}
                    {/* hover crosshair */}
                    {hoverPct !== null && (
                        <>
                            <line x1={hoverPct.svgX} y1={0} x2={hoverPct.svgX} y2={CHART_HEIGHT}
                                stroke={contextWarningPrefs.enabled && hoverPct.pct >= contextWarningPrefs.thresholdPct ? "var(--warn)" : strokeColor} strokeWidth={1} opacity={0.5} />
                            <circle
                                cx={hoverPct.svgX}
                                cy={PADDING_TOP + INNER_H - (hoverPct.pct / 100) * INNER_H}
                                r={4}
                                fill={contextWarningPrefs.enabled && hoverPct.pct >= contextWarningPrefs.thresholdPct ? "var(--warn)" : strokeColor}
                                opacity={1}
                            />
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
}

interface ModelBarProps {
    readonly spans: readonly ModelSpan[];
    readonly chartWidth: number;
    readonly currentModel: string | null;
    readonly hoverSvgX: number | null;
    readonly onHoverChange: (svgX: number | null) => void;
}

function findSpanAtX(spans: readonly ModelSpan[], svgX: number): ModelSpan | null {
    for (const span of spans) {
        if (svgX >= span.x && svgX <= span.endX) return span;
    }
    return null;
}

function ModelBar({ spans, chartWidth, currentModel, hoverSvgX, onHoverChange }: ModelBarProps): React.JSX.Element {
    const svgWrapRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback((clientX: number): void => {
        const el = svgWrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onHoverChange(ratio * chartWidth);
    }, [chartWidth, onHoverChange]);

    const hoveredSpan = hoverSvgX !== null ? findSpanAtX(spans, hoverSvgX) : null;
    const displayModel = hoveredSpan ? hoveredSpan.modelId : currentModel;

    return (
        <div className="timeline-context-chart-row timeline-context-model-row">
            <div className="timeline-context-chart-label timeline-context-model-label">
                <span>Model</span>
                {displayModel && (
                    <span className="timeline-context-chart-pct" style={{ color: "var(--text-secondary)" }}>
                        {shortenModelId(displayModel)}
                    </span>
                )}
            </div>
            <div
                ref={svgWrapRef}
                className="timeline-context-chart-svg-wrap"
                onMouseMove={(e) => handleMouseMove(e.clientX)}
                onMouseLeave={() => onHoverChange(null)}
            >
                <svg
                    width="100%"
                    height={MODEL_BAR_HEIGHT}
                    viewBox={`0 0 ${chartWidth} ${MODEL_BAR_HEIGHT}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {spans.map((span, i) => {
                        const w = span.endX - span.x;
                        const midX = span.x + w / 2;
                        const isHovered = hoveredSpan === span;
                        const color = modelFamilyColor(span.label);
                        return (
                            <g key={i}>
                                {/* span background — colored per model family */}
                                <rect
                                    x={span.x}
                                    y={2}
                                    width={Math.max(w, 0)}
                                    height={MODEL_BAR_HEIGHT - 4}
                                    fill={color}
                                    opacity={isHovered ? 0.85 : 0.55}
                                    rx={2}
                                />
                                {/* change marker line between spans */}
                                {i > 0 && (
                                    <line x1={span.x} y1={0} x2={span.x} y2={MODEL_BAR_HEIGHT}
                                        stroke="#0f172a" strokeWidth={1} opacity={0.8} />
                                )}
                                {/* label — only if wide enough */}
                                {w > 24 && (
                                    <text
                                        x={midX}
                                        y={MODEL_BAR_HEIGHT / 2 + 1}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize={8}
                                        fontWeight={700}
                                        fill="#ffffff"
                                        style={{ fontFamily: "inherit" }}
                                    >
                                        {span.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                    {/* hover crosshair */}
                    {hoverSvgX !== null && (
                        <line x1={hoverSvgX} y1={0} x2={hoverSvgX} y2={MODEL_BAR_HEIGHT}
                            stroke="var(--accent)" strokeWidth={1} opacity={0.5} />
                    )}
                </svg>
            </div>
        </div>
    );
}

export function TimelineContextChart({ timelineWidth, allItems, snapshotItems, compactItems, contextWarningPrefs }: ContextChartProps): React.JSX.Element | null {
    const sortedLefts = useMemo(
        () => [...allItems].map(i => i.left).sort((a, b) => a - b),
        [allItems],
    );
    const segments = useMemo(
        () => buildSegments(sortedLefts, timelineWidth),
        [sortedLefts, timelineWidth],
    );

    const CHART_WIDTH = Math.max(timelineWidth, 1);

    const ctxPoints = useMemo(
        () => buildPoints(snapshotItems, "contextWindowUsedPct", segments, CHART_WIDTH),
        [snapshotItems, segments, CHART_WIDTH],
    );
    const modelSpans = useMemo(
        () => buildModelSpans(snapshotItems, segments, CHART_WIDTH),
        [snapshotItems, segments, CHART_WIDTH],
    );

    const modelChangeXs = useMemo(
        () => modelSpans.slice(1).map(s => s.x),
        [modelSpans],
    );

    const compactMarkers = useMemo<readonly CompactMarker[]>(
        () => compactItems
            .map((item) => {
                const meta = item.event.metadata;
                const phase = typeof meta["compactPhase"] === "string" ? (meta["compactPhase"]) : "";
                return { x: realToX(item.left, segments, CHART_WIDTH), phase };
            })
            .filter((m) => m.phase !== ""),
        [compactItems, segments, CHART_WIDTH],
    );

    const currentModel = useMemo(() => {
        const sorted = [...snapshotItems].sort((a, b) => a.left - b.left);
        const last = sorted[sorted.length - 1];
        if (!last) return null;
        const meta = last.event.metadata;
        return typeof meta["modelId"] === "string" ? meta["modelId"] : null;
    }, [snapshotItems]);

    const hasCtx = ctxPoints.length > 0;
    const hasModel = modelSpans.length > 0;

    const [hoverSvgX, setHoverSvgX] = useState<number | null>(null);

    if (!hasCtx) return null;

    return (
        <div className="timeline-context-charts">
            <ChartRow
                points={ctxPoints}
                chartWidth={CHART_WIDTH}
                label="Context"
                fillId="ctx-fill"
                strokeColor="var(--accent)"
                fillColor="var(--accent)"
                fillOpacity={0.18}
                labelColor="var(--accent)"
                modelChangeXs={modelChangeXs}
                compactMarkers={compactMarkers}
                hoverSvgX={hoverSvgX}
                onHoverChange={setHoverSvgX}
                contextWarningPrefs={contextWarningPrefs}
            />
            {hasModel && (
                <ModelBar
                    spans={modelSpans}
                    chartWidth={CHART_WIDTH}
                    currentModel={currentModel}
                    hoverSvgX={hoverSvgX}
                    onHoverChange={setHoverSvgX}
                />
            )}
        </div>
    );
}
