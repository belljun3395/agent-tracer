import type React from "react";
import { useMemo } from "react";
import type { TimelineEventRecord } from "../../../types.js";
import { RULER_HEIGHT, type TimelineLayout } from "../../../types.js";

interface TimelineSessionMarkersProps {
    readonly events: readonly TimelineEventRecord[];
    readonly layout: TimelineLayout;
    readonly canvasHeight: number;
    readonly canvasWidth: number;
}

function getSessionMarkerLabel(event: TimelineEventRecord): string {
    const compactPhase = event.metadata["compactPhase"];
    if (compactPhase === "before") return "Compacting";
    if (compactPhase === "after") return "Compacted";
    const trigger = event.metadata["trigger"];
    switch (trigger) {
        case "startup": return "Start";
        case "resume": return "Resume";
        case "clear": return "Clear";
        case "compact": return "Compact";
        default: return "Session";
    }
}

export function TimelineSessionMarkers({
    events,
    layout,
    canvasHeight,
    canvasWidth,
}: TimelineSessionMarkersProps): React.JSX.Element | null {
    const markers = useMemo(
        () =>
            events.map((event) => ({
                event,
                left: Math.max(layout.leftGutter, Math.min(layout.tsToLeft(Date.parse(event.createdAt)), canvasWidth)),
                label: getSessionMarkerLabel(event),
            })),
        [events, layout, canvasWidth],
    );

    if (markers.length === 0) return null;

    const bodyTop = RULER_HEIGHT;
    const bodyHeight = Math.max(0, canvasHeight - RULER_HEIGHT);

    return (
        <div className="timeline-session-markers" aria-hidden>
            {markers.map(({ event, left, label }) => (
                <div key={event.id} className="timeline-session-marker">
                    <div
                        className="timeline-session-marker-line"
                        style={{ left: `${left}px`, top: `${bodyTop}px`, height: `${bodyHeight}px` }}
                    />
                    <div
                        className="timeline-session-marker-badge"
                        style={{ left: `${left + 4}px` }}
                        title={event.title}
                    >
                        {label}
                    </div>
                </div>
            ))}
        </div>
    );
}
