import type React from "react";
import { RULER_HEIGHT, TIMELINE_LANES } from "~app/lib/timeline.js";
import type { TimelineConnector, TimestampTick } from "~app/lib/timeline.js";
import { cn } from "~app/lib/ui/cn.js";

interface TimelineOverlaySvgProps {
    readonly width: number;
    readonly height: number;
    readonly timestampTicks: readonly TimestampTick[];
    readonly connectors: readonly TimelineConnector[];
    readonly selectedConnectorKey: string | null;
    readonly onSelectConnector: (key: string) => void;
}

export function TimelineOverlaySvg({
    width,
    height,
    timestampTicks,
    connectors,
    selectedConnectorKey,
    onSelectConnector,
}: TimelineOverlaySvgProps): React.JSX.Element {
    return (
        <svg
            className="timeline-overlay"
            style={{ width, height }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>Timeline overlay</title>
            <defs>
                {TIMELINE_LANES.map((lane) => (
                    <marker
                        key={lane}
                        id={`arrow-${lane}`}
                        markerWidth="6"
                        markerHeight="4"
                        refX="5"
                        refY="2"
                        orient="auto"
                    >
                        <polygon points="0 0, 6 2, 0 4" className={`arrow-tip ${lane}`} />
                    </marker>
                ))}
            </defs>

            <rect x="0" y="0" width={width} height={RULER_HEIGHT} className="ruler-bg" />
            <line x1="0" y1={RULER_HEIGHT} x2={width} y2={RULER_HEIGHT} className="ruler-baseline" />

            {timestampTicks.map((tick) => (
                <g key={tick.label + tick.x}>
                    <line x1={tick.x} y1={RULER_HEIGHT - 6} x2={tick.x} y2={RULER_HEIGHT} className="ruler-tick" />
                    <text x={tick.x + 4} y={RULER_HEIGHT - 8} className="ruler-label">
                        {tick.label}
                    </text>
                    <line x1={tick.x} y1={RULER_HEIGHT} x2={tick.x} y2={height} className="grid-line" />
                </g>
            ))}

            {connectors.filter((c) => c.cross).map((c) => (
                <g key={c.key}>
                    <path
                        d={c.path}
                        className={cn("connector-hitbox", selectedConnectorKey === c.key && "active")}
                        onClick={() => onSelectConnector(c.key)}
                    />
                    <path
                        d={c.path}
                        className={cn(`connector ${c.lane} cross-lane`, selectedConnectorKey === c.key && "active")}
                        onClick={() => onSelectConnector(c.key)}
                    />
                </g>
            ))}
            {connectors.filter((c) => !c.cross).map((c) => (
                <g key={c.key}>
                    <path
                        d={c.path}
                        className={cn("connector-hitbox", selectedConnectorKey === c.key && "active")}
                        onClick={() => onSelectConnector(c.key)}
                    />
                    <path
                        d={c.path}
                        className={cn(`connector ${c.lane}`, selectedConnectorKey === c.key && "active")}
                        markerEnd={`url(#arrow-${c.lane})`}
                        onClick={() => onSelectConnector(c.key)}
                    />
                </g>
            ))}
        </svg>
    );
}
