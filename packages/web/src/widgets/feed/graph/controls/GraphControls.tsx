import { cn } from "~web/shared/ui/lib/cn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Tooltip } from "~web/shared/ui/index.js";
import {
  DEFAULT_GRAPH_ZOOM,
  MAX_GRAPH_ZOOM,
  MIN_GRAPH_ZOOM,
  clampGraphZoom,
} from "~web/widgets/feed/graph/model/zoom.js";

interface GraphControlsProps {
  readonly zoom: number;
  readonly onZoom: (next: number) => void;
  readonly hideEmptyLanes: boolean;
  readonly onToggleEmptyLanes: () => void;
  readonly hiddenEmptyCount: number;
}

/** 그래프 확대와 빈 레인 표시 설정을 변경한다. */
export function GraphControls({
  zoom,
  onZoom,
  hideEmptyLanes,
  onToggleEmptyLanes,
  hiddenEmptyCount,
}: GraphControlsProps) {
  const guidance = useGuidance();
  const setClamped = (next: number) => onZoom(clampGraphZoom(next));
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-3 border-t border-hair bg-canvas font-mono text-[10.5px] text-ink-tertiary">
      <span>zoom</span>
      <button
        type="button"
        onClick={() => setClamped(zoom / 1.5)}
        aria-label="Zoom out"
        className={zoomButtonClassName}
        disabled={zoom <= MIN_GRAPH_ZOOM}
      >
        −
      </button>
      <span className="min-w-9 text-center text-ink-muted">
        {zoom.toFixed(1)}×
      </span>
      <button
        type="button"
        onClick={() => setClamped(zoom * 1.5)}
        aria-label="Zoom in"
        className={zoomButtonClassName}
        disabled={zoom >= MAX_GRAPH_ZOOM}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onZoom(DEFAULT_GRAPH_ZOOM)}
        className={cn(zoomButtonClassName, "w-auto px-2")}
        disabled={zoom === DEFAULT_GRAPH_ZOOM}
      >
        reset
      </button>
      {(hiddenEmptyCount > 0 || !hideEmptyLanes) && (
        <Tooltip
          content={
            <GuidanceText
              locale={guidance.locale}
              message={
                hideEmptyLanes
                  ? guidance.messages.feed.emptyLanesHidden(hiddenEmptyCount)
                  : guidance.messages.feed.hideEmptyLanes
              }
            />
          }
        >
          <button
            type="button"
            onClick={onToggleEmptyLanes}
            aria-pressed={!hideEmptyLanes}
            className={cn(
              zoomButtonClassName,
              "w-auto px-2",
              hideEmptyLanes ? "text-ink-muted bg-s1" : "text-ink bg-s2",
            )}
          >
            {hideEmptyLanes
              ? `+${hiddenEmptyCount} empty lane${hiddenEmptyCount === 1 ? "" : "s"}`
              : "all lanes"}
          </button>
        </Tooltip>
      )}
      <GuidanceText
        className="ml-auto"
        locale={guidance.locale}
        message={guidance.messages.feed.graphNavigation}
      />
    </div>
  );
}

const zoomButtonClassName =
  "h-[22px] w-[22px] border border-hair rounded-xs bg-s1 text-ink-muted cursor-pointer";
