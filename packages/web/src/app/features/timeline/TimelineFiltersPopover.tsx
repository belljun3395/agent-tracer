import type React from "react";
import { TIMELINE_LANES } from "~app/lib/timeline.js";
import type { TimelineLane } from "~domain/monitoring.js";
import { getLaneTheme } from "~app/lib/ui/laneTheme.js";

export function TimelineFiltersPopover({ filtersPopoverRef, filtersPopoverPos, zoom, onZoomChange, activeLaneCount, totalLaneCount, filters, setFilters }: {
    readonly filtersPopoverRef: React.RefObject<HTMLDivElement | null>;
    readonly filtersPopoverPos: {
        top: number;
        right: number;
    };
    readonly zoom: number;
    readonly onZoomChange: (zoom: number) => void;
    readonly activeLaneCount: number;
    readonly totalLaneCount: number;
    readonly filters: Record<TimelineLane, boolean>;
    readonly setFilters: React.Dispatch<React.SetStateAction<Record<TimelineLane, boolean>>>;
}): React.JSX.Element {
    return (<div ref={filtersPopoverRef} className="timeline-filters-popover" style={{ position: "fixed", top: filtersPopoverPos.top, right: filtersPopoverPos.right, zIndex: 200 }}>
      <div className="timeline-popover-header">
        <span>Filters & Zoom</span>
        <span className="timeline-popover-summary">{activeLaneCount}/{totalLaneCount} lanes</span>
      </div>
      <div className="timeline-filters-popover-section">
        <span className="toolbar-label">Zoom</span>
        <div className="toolbar-group" style={{ flex: 1 }}>
          <input max={2.5} min={0.8} step={0.1} style={{ flex: 1 }} type="range" value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))}/>
          <span className="toolbar-value">{zoom.toFixed(1)}×</span>
        </div>
      </div>

      <div className="timeline-filters-popover-divider"/>

      <div className="timeline-filters-popover-section" style={{ flexWrap: "wrap" }}>
        <button className={`filter-chip all-toggle${activeLaneCount === totalLaneCount ? " active" : ""}`} type="button" onClick={() => {
            const allOn = activeLaneCount === totalLaneCount;
            const next = Object.fromEntries(TIMELINE_LANES.map((lane) => [lane, !allOn])) as Record<TimelineLane, boolean>;
            setFilters(next);
        }}>
          {activeLaneCount === totalLaneCount ? "All lanes" : `${activeLaneCount}/${totalLaneCount} lanes`}
        </button>
        {TIMELINE_LANES.map((lane) => (<label key={lane} className={`filter-chip ${lane}${filters[lane] ? " active" : ""}`}>
            <input checked={filters[lane]} type="checkbox" onChange={() => setFilters((current) => ({ ...current, [lane]: !current[lane] }))}/>
            <span className="filter-dot"/>
            {getLaneTheme(lane).label}
          </label>))}
      </div>
    </div>);
}
