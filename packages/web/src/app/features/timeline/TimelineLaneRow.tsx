import type React from "react";
import {
    isExpandableLane,
    LANE_HEIGHT,
    RULER_HEIGHT,
    type ExpandableTimelineLane,
    type TimelineLaneRow as TimelineLaneRowData,
} from "../../../types.js";
import { cn } from "../../lib/ui/cn.js";
import { getLaneTheme } from "../../lib/ui/laneTheme.js";

interface TimelineLaneRowProps {
    readonly row: TimelineLaneRowData;
    readonly index: number;
    readonly expandedSubtypeLanes: Record<ExpandableTimelineLane, boolean>;
    readonly laneSubtypeCounts: Record<ExpandableTimelineLane, number>;
    readonly firstExpandedSubtypeRowByLane: ReadonlyMap<ExpandableTimelineLane, string>;
    readonly onToggleLane: (lane: ExpandableTimelineLane, expanded: boolean) => void;
}

export function TimelineLaneRow({
    row,
    index,
    expandedSubtypeLanes,
    laneSubtypeCounts,
    firstExpandedSubtypeRowByLane,
    onToggleLane,
}: TimelineLaneRowProps): React.JSX.Element {
    const laneTheme = getLaneTheme(row.baseLane);
    const expandableLane = isExpandableLane(row.baseLane) ? row.baseLane : null;
    const subtypeCount = expandableLane ? laneSubtypeCounts[expandableLane] : 0;
    const isExpanded = expandableLane ? expandedSubtypeLanes[expandableLane] : false;
    const showExpandButton = Boolean(expandableLane && !row.isSubtype && subtypeCount > 0);
    const showCollapseButton = Boolean(
        expandableLane &&
        row.isSubtype &&
        firstExpandedSubtypeRowByLane.get(expandableLane) === row.key,
    );

    return (
        <div
            className={cn("lane-row", index % 2 === 1 && "striped")}
            style={{ top: `${RULER_HEIGHT + index * LANE_HEIGHT}px` }}
        >
            <div
                className={cn("lane-label", row.baseLane, row.isSubtype && "subtype")}
                title={row.isSubtype ? `${laneTheme.label} • ${row.subtypeLabel}` : laneTheme.description}
            >
                <img className={`lane-icon ${row.baseLane}`} src={laneTheme.icon} alt="" />
                <span className="lane-label-copy">
                    <span>{row.isSubtype ? row.subtypeLabel : laneTheme.label}</span>
                    {row.isSubtype && (
                        <span className="lane-subtype-parent">{laneTheme.label}</span>
                    )}
                </span>
                {showExpandButton && (
                    <button
                        aria-label={`Show ${subtypeCount} ${laneTheme.label} details`}
                        className={cn("lane-expand-toggle", row.baseLane, isExpanded && "active")}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleLane(expandableLane!, !isExpanded);
                        }}
                        title={`${laneTheme.label} details`}
                        type="button"
                    >
                        <span className="lane-expand-count">{subtypeCount}</span>
                        <span className="lane-expand-label">details</span>
                        <span>{isExpanded ? "▾" : "▸"}</span>
                    </button>
                )}
                {showCollapseButton && (
                    <button
                        aria-label={`Hide ${laneTheme.label} details`}
                        className={cn("lane-expand-toggle", row.baseLane, "active")}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleLane(expandableLane!, false);
                        }}
                        title={`Fold ${laneTheme.label} details`}
                        type="button"
                    >
                        <span className="lane-expand-label">hide</span>
                        <span>▾</span>
                    </button>
                )}
            </div>
            <div className="lane-track" />
            <div className="lane-separator" />
        </div>
    );
}
