import type React from "react";
import { useMemo } from "react";
import type { TurnSegment } from "../../../types.js";
import { RULER_HEIGHT, type TimelineLayout } from "../../../types.js";
import { cn } from "../../lib/ui/cn.js";

interface TimelineTurnOverlayProps {
    readonly segments: readonly TurnSegment[];
    readonly layout: TimelineLayout;
    readonly canvasHeight: number;
    readonly canvasWidth: number;
    readonly activeTurnIndex?: number | null;
    readonly onSelectTurn?: (turnIndex: number) => void;
    readonly sessionMarkerLefts?: readonly number[];
}

interface TurnBand {
    readonly turn: TurnSegment;
    readonly left: number;
    readonly right: number;
}

export function TimelineTurnOverlay({
    segments,
    layout,
    canvasHeight,
    canvasWidth,
    activeTurnIndex,
    onSelectTurn,
    sessionMarkerLefts = [],
}: TimelineTurnOverlayProps): React.JSX.Element | null {
    const bands = useMemo<readonly TurnBand[]>(() => {
        if (segments.length === 0) {
            return [];
        }
        return segments.map((turn, index) => {
            const startMs = Date.parse(turn.startAt);
            const nextTurn = segments[index + 1];
            const endMs = nextTurn ? Date.parse(nextTurn.startAt) : Date.parse(turn.endAt);
            const rawLeft = layout.tsToLeft(startMs);
            const rawRight = nextTurn ? layout.tsToLeft(endMs) : canvasWidth;
            return {
                turn,
                left: Math.max(layout.leftGutter, Math.min(rawLeft, canvasWidth)),
                right: Math.max(layout.leftGutter, Math.min(rawRight, canvasWidth)),
            };
        });
    }, [canvasWidth, layout, segments]);

    if (bands.length === 0) {
        return null;
    }

    const nonPreludeBands = bands.filter((band) => !band.turn.isPrelude);
    const bodyTop = RULER_HEIGHT;
    const bodyHeight = Math.max(0, canvasHeight - RULER_HEIGHT);

    return (
        <div className="timeline-turn-overlay" aria-hidden={!onSelectTurn}>
            {bands.map((band, index) => (
                <div
                    key={`band-${band.turn.turnIndex}`}
                    className={cn(
                        "timeline-turn-band",
                        band.turn.isPrelude && "is-prelude",
                        index % 2 === 1 && "is-alt",
                        activeTurnIndex === band.turn.turnIndex && "is-active",
                    )}
                    style={{
                        left: `${band.left}px`,
                        top: `${bodyTop}px`,
                        width: `${Math.max(0, band.right - band.left)}px`,
                        height: `${bodyHeight}px`,
                    }}
                />
            ))}
            {nonPreludeBands.map((band) => (
                <div
                    key={`divider-${band.turn.turnIndex}`}
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
                    if (width < 28) {
                        return null;
                    }
                    if (band.turn.isPrelude && sessionMarkerLefts.some((x) => Math.abs(x - band.left) < 40)) {
                        return null;
                    }
                    const label = band.turn.isPrelude ? "Prelude" : `Turn ${band.turn.turnIndex}`;
                    const tooltip = band.turn.requestPreview
                        ? `${label} · ${band.turn.requestPreview}`
                        : label;
                    const isClickable = Boolean(onSelectTurn);
                    return (
                        <button
                            key={`badge-${band.turn.turnIndex}`}
                            type="button"
                            className={cn(
                                "timeline-turn-badge",
                                band.turn.isPrelude && "is-prelude",
                                activeTurnIndex === band.turn.turnIndex && "is-active",
                            )}
                            style={{
                                left: `${band.left + 6}px`,
                                maxWidth: `${Math.max(24, width - 12)}px`,
                            }}
                            title={tooltip}
                            onClick={isClickable ? () => onSelectTurn?.(band.turn.turnIndex) : undefined}
                            tabIndex={isClickable ? 0 : -1}
                            disabled={!isClickable}
                        >
                            <span className="timeline-turn-badge-label">{label}</span>
                            {band.turn.requestPreview && (
                                <span className="timeline-turn-badge-preview">{band.turn.requestPreview}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
