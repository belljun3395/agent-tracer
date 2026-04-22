import type React from "react";
import { useMemo } from "react";
import type { TurnGroup, TurnPartition, TurnSegment } from "../../../types.js";
import { RULER_HEIGHT, scopeLabelForGroup, type TimelineLayout } from "../../../types.js";
import { cn } from "../../lib/ui/cn.js";

interface TimelineTurnOverlayProps {
    readonly segments: readonly TurnSegment[];
    readonly layout: TimelineLayout;
    readonly canvasHeight: number;
    readonly canvasWidth: number;
    readonly partition?: TurnPartition | null;
    readonly activeTurnIndex?: number | null;
    readonly focusedGroupId?: string | null;
    readonly onSelectTurn?: ((turnIndex: number) => void) | undefined;
    readonly onSelectGroup?: ((groupId: string | null) => void) | undefined;
    readonly sessionMarkerLefts?: readonly number[];
}

interface OverlayBand {
    readonly key: string;
    readonly label: string;
    readonly isPrelude: boolean;
    readonly isHidden: boolean;
    readonly group: TurnGroup | null;
    readonly turnIndex: number | null;
    readonly startAt: string;
    readonly endAt: string;
    readonly left: number;
    readonly right: number;
}

export function TimelineTurnOverlay({
    segments,
    layout,
    canvasHeight,
    canvasWidth,
    partition,
    activeTurnIndex,
    focusedGroupId,
    onSelectTurn,
    onSelectGroup,
    sessionMarkerLefts = [],
}: TimelineTurnOverlayProps): React.JSX.Element | null {
    const bands = useMemo<readonly OverlayBand[]>(() => {
        if (segments.length === 0) return [];
        const nonPrelude = segments.filter((s) => !s.isPrelude);
        const segmentByTurn = new Map<number, TurnSegment>();
        for (const s of nonPrelude) segmentByTurn.set(s.turnIndex, s);

        const nextStartAt = (turnIndex: number): string | null => {
            const next = segmentByTurn.get(turnIndex + 1);
            return next?.startAt ?? null;
        };

        const resolveBand = (
            startAt: string,
            endAt: string | null,
            label: string,
            group: TurnGroup | null,
            turnIndex: number | null,
            isPrelude: boolean,
            isHidden: boolean,
            key: string,
        ): OverlayBand => {
            const startMs = Date.parse(startAt);
            const endMs = endAt ? Date.parse(endAt) : null;
            const rawLeft = layout.tsToLeft(startMs);
            const rawRight = endMs !== null ? layout.tsToLeft(endMs) : canvasWidth;
            return {
                key,
                label,
                isPrelude,
                isHidden,
                group,
                turnIndex,
                startAt,
                endAt: endAt ?? startAt,
                left: Math.max(layout.leftGutter, Math.min(rawLeft, canvasWidth)),
                right: Math.max(layout.leftGutter, Math.min(rawRight, canvasWidth)),
            };
        };

        const result: OverlayBand[] = [];
        const preludeSegment = segments.find((s) => s.isPrelude) ?? null;
        if (preludeSegment) {
            const endAt = nonPrelude[0]?.startAt ?? preludeSegment.endAt;
            result.push(resolveBand(preludeSegment.startAt, endAt, "Prelude", null, 0, true, false, "prelude"));
        }

        if (partition && partition.groups.length > 0) {
            for (const group of partition.groups) {
                const firstSegment = segmentByTurn.get(group.from);
                const lastSegment = segmentByTurn.get(group.to);
                if (!firstSegment || !lastSegment) continue;
                const endAt = nextStartAt(group.to) ?? lastSegment.endAt;
                const label = scopeLabelForGroup(group);
                result.push(
                    resolveBand(firstSegment.startAt, endAt, label, group, null, false, !group.visible, `group-${group.id}`),
                );
            }
        } else {
            for (const segment of nonPrelude) {
                const endAt = nextStartAt(segment.turnIndex) ?? segment.endAt;
                result.push(
                    resolveBand(segment.startAt, endAt, `Turn ${segment.turnIndex}`, null, segment.turnIndex, false, false, `turn-${segment.turnIndex}`),
                );
            }
        }

        return result;
    }, [canvasWidth, layout, partition, segments]);

    if (bands.length === 0) {
        return null;
    }

    const bodyTop = RULER_HEIGHT;
    const bodyHeight = Math.max(0, canvasHeight - RULER_HEIGHT);
    const isBandActive = (band: OverlayBand): boolean => {
        if (band.group && focusedGroupId && band.group.id === focusedGroupId) return true;
        if (band.turnIndex !== null && activeTurnIndex !== null && activeTurnIndex !== undefined && band.turnIndex === activeTurnIndex) return true;
        return false;
    };

    return (
        <div className="timeline-turn-overlay" aria-hidden={!onSelectTurn && !onSelectGroup}>
            {bands.map((band, index) => (
                <div
                    key={`band-${band.key}`}
                    className={cn(
                        "timeline-turn-band",
                        band.isPrelude && "is-prelude",
                        index % 2 === 1 && "is-alt",
                        isBandActive(band) && "is-active",
                        band.isHidden && "is-hidden",
                    )}
                    style={{
                        left: `${band.left}px`,
                        top: `${bodyTop}px`,
                        width: `${Math.max(0, band.right - band.left)}px`,
                        height: `${bodyHeight}px`,
                        ...(band.isHidden ? { opacity: 0.35 } : {}),
                    }}
                />
            ))}
            {bands
                .filter((band) => !band.isPrelude)
                .map((band) => (
                    <div
                        key={`divider-${band.key}`}
                        className="timeline-turn-divider"
                        style={{
                            left: `${band.left}px`,
                            top: `${bodyTop}px`,
                            height: `${bodyHeight}px`,
                        }}
                    />
                ))}
            <div className="timeline-turn-ruler" style={{ height: `${RULER_HEIGHT}px` }}>
                {bands.map((band) => {
                    const width = Math.max(0, band.right - band.left);
                    if (width < 28) return null;
                    if (band.isPrelude && sessionMarkerLefts.some((x) => Math.abs(x - band.left) < 40)) return null;
                    const isClickable = Boolean(band.group ? onSelectGroup : onSelectTurn);
                    const handleClick = (): void => {
                        if (band.group && onSelectGroup) {
                            onSelectGroup(focusedGroupId === band.group.id ? null : band.group.id);
                        } else if (band.turnIndex !== null && onSelectTurn) {
                            onSelectTurn(band.turnIndex);
                        }
                    };
                    return (
                        <button
                            key={`badge-${band.key}`}
                            type="button"
                            className={cn(
                                "timeline-turn-badge",
                                band.isPrelude && "is-prelude",
                                isBandActive(band) && "is-active",
                                band.isHidden && "is-hidden",
                            )}
                            style={{
                                left: `${band.left + 6}px`,
                                maxWidth: `${Math.max(24, width - 12)}px`,
                                ...(band.isHidden ? { opacity: 0.45 } : {}),
                            }}
                            title={band.label}
                            onClick={isClickable ? handleClick : undefined}
                            tabIndex={isClickable ? 0 : -1}
                            disabled={!isClickable}
                        >
                            <span className="timeline-turn-badge-label">{band.label}</span>
                            {band.isHidden && <span className="timeline-turn-badge-preview">hidden</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
