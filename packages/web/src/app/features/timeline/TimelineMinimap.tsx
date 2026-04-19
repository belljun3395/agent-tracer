import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineItemLayout, TimelineLaneRow } from "../../../types.js";

export interface MinimapProps {
    readonly timelineWidth: number;
    readonly canvasHeight: number;
    readonly items: readonly TimelineItemLayout[];
    readonly laneRows: readonly TimelineLaneRow[];
    readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}

const GAP_THRESHOLD_RATIO = 0.10;
const GAP_DISPLAY_FRACTION = 0.03;

interface MapSegment {
    readonly realStart: number;
    readonly realEnd: number;
    readonly mapStart: number;
    readonly mapEnd: number;
    readonly isGap: boolean;
}

function buildCompressedMap(sortedLefts: readonly number[], totalWidth: number): readonly MapSegment[] {
    const threshold = totalWidth * GAP_THRESHOLD_RATIO;
    const gapIntervals: Array<[number, number]> = [];
    for (let i = 0; i < sortedLefts.length - 1; i++) {
        const gap = (sortedLefts[i + 1] ?? 0) - (sortedLefts[i] ?? 0);
        if (gap > threshold)
            gapIntervals.push([sortedLefts[i] ?? 0, sortedLefts[i + 1] ?? 0]);
    }
    if (gapIntervals.length === 0) {
        return [{ realStart: 0, realEnd: totalWidth, mapStart: 0, mapEnd: 1, isGap: false }];
    }
    const rawSegments: Array<{ start: number; end: number; isGap: boolean }> = [];
    let cursor = 0;
    for (const [gStart, gEnd] of gapIntervals) {
        if (cursor < gStart)
            rawSegments.push({ start: cursor, end: gStart, isGap: false });
        rawSegments.push({ start: gStart, end: gEnd, isGap: true });
        cursor = gEnd;
    }
    if (cursor < totalWidth)
        rawSegments.push({ start: cursor, end: totalWidth, isGap: false });
    const nGaps = gapIntervals.length;
    const totalContentReal = rawSegments
        .filter(s => !s.isGap)
        .reduce((sum, s) => sum + (s.end - s.start), 0);
    const contentDisplayTotal = Math.max(0.01, 1 - nGaps * GAP_DISPLAY_FRACTION);
    const result: MapSegment[] = [];
    let mapCursor = 0;
    for (const seg of rawSegments) {
        const realLen = seg.end - seg.start;
        const mapLen = seg.isGap
            ? GAP_DISPLAY_FRACTION
            : (realLen / Math.max(1, totalContentReal)) * contentDisplayTotal;
        result.push({ realStart: seg.start, realEnd: seg.end, mapStart: mapCursor, mapEnd: mapCursor + mapLen, isGap: seg.isGap });
        mapCursor += mapLen;
    }
    return result;
}

function realToCompressed(realPx: number, segments: readonly MapSegment[]): number {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (realPx <= seg.realEnd || i === segments.length - 1) {
            const span = seg.realEnd - seg.realStart;
            const t = span > 0 ? (realPx - seg.realStart) / span : 0;
            return seg.mapStart + t * (seg.mapEnd - seg.mapStart);
        }
    }
    return 1;
}

function compressedToReal(ratio: number, segments: readonly MapSegment[]): number {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (ratio <= seg.mapEnd || i === segments.length - 1) {
            const span = seg.mapEnd - seg.mapStart;
            const t = span > 1e-9 ? (ratio - seg.mapStart) / span : 0;
            return seg.realStart + t * (seg.realEnd - seg.realStart);
        }
    }
    return segments[segments.length - 1]?.realEnd ?? 1;
}

export function TimelineMinimap({ timelineWidth, items, laneRows, scrollRef }: MinimapProps): React.JSX.Element | null {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({ left: 0, viewWidth: 0, totalWidth: 1 });
    const isDragging = useRef(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const update = (): void => {
            setScrollState({ left: el.scrollLeft, viewWidth: el.clientWidth, totalWidth: Math.max(el.scrollWidth, 1) });
        };
        update();
        el.addEventListener("scroll", update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            ro.disconnect();
        };
    }, [scrollRef]);
    const sortedLefts = useMemo(() => [...items].map(i => i.left).sort((a, b) => a - b), [items]);
    const segments = useMemo(() => buildCompressedMap(sortedLefts, timelineWidth), [sortedLefts, timelineWidth]);
    const scrubToClientX = (clientX: number): void => {
        const container = containerRef.current;
        const scrollEl = scrollRef.current;
        if (!container || !scrollEl)
            return;
        const rect = container.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const realPx = compressedToReal(ratio, segments);
        const target = (realPx / timelineWidth) * scrollState.totalWidth - scrollState.viewWidth / 2;
        scrollEl.scrollLeft = Math.max(0, Math.min(scrollState.totalWidth - scrollState.viewWidth, target));
    };
    const laneCount = laneRows.length;
    const viewportRealLeft = (scrollState.left / scrollState.totalWidth) * timelineWidth;
    const viewportRealRight = viewportRealLeft + (scrollState.viewWidth / scrollState.totalWidth) * timelineWidth;
    const viewportLeftPct = realToCompressed(viewportRealLeft, segments) * 100;
    const viewportWidthPct = (realToCompressed(viewportRealRight, segments) - realToCompressed(viewportRealLeft, segments)) * 100;
    if (laneCount === 0 || timelineWidth === 0)
        return null;
    return (<div ref={containerRef} className="timeline-minimap" role="scrollbar" aria-label="Timeline minimap" aria-valuenow={Math.round(viewportLeftPct)} onPointerDown={(e) => {
            isDragging.current = true;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            scrubToClientX(e.clientX);
            e.preventDefault();
        }} onPointerMove={(e) => {
            if (!isDragging.current)
                return;
            scrubToClientX(e.clientX);
        }} onPointerUp={(e) => {
            isDragging.current = false;
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }} onPointerCancel={(e) => {
            isDragging.current = false;
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }}>
      {laneRows.map((row, i) => (<div key={row.key} className={`minimap-lane ${row.baseLane}`} style={{
                top: `${(i / laneCount) * 100}%`,
                height: `${(1 / laneCount) * 100}%`
            }}/>))}

      {segments.filter(s => s.isGap).map((seg, i) => (<div key={i} className="minimap-gap" style={{ left: `${seg.mapStart * 100}%`, width: `${(seg.mapEnd - seg.mapStart) * 100}%` }}/>))}

      {items.map((item) => {
            const laneIndex = laneRows.findIndex((row) => row.key === item.laneKey);
            if (laneIndex < 0)
                return null;
            const leftPct = realToCompressed(item.left, segments) * 100;
            const topPct = ((laneIndex + 0.5) / laneCount) * 100;
            return (<div key={item.event.id} className={`minimap-dot ${item.baseLane}`} style={{ left: `${leftPct}%`, top: `${topPct}%` }}/>);
        })}

      <div className="minimap-viewport" style={{ left: `${viewportLeftPct}%`, width: `${Math.max(viewportWidthPct, 2)}%` }} title="Currently visible timeline range"/>
    </div>);
}
