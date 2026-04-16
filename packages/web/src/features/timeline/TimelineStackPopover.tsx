import type React from "react";
import {
    formatRelativeTime,
    KO_TIMELINE_STACKED_EVENTS,
    type TimelineEvent,
    type TimelineItemLayout,
} from "@monitor/web-domain";
import { cn } from "../../lib/ui/cn.js";
import { getLaneTheme } from "../../lib/ui/laneTheme.js";
import type { NodeBounds } from "./utils.js";

interface TimelineStackPopoverProps {
    readonly openStackEventId: string;
    readonly items: readonly TimelineItemLayout[];
    readonly stackGroups: ReadonlyMap<string, readonly TimelineItemLayout[]>;
    readonly nodeBounds: Readonly<Record<string, NodeBounds>>;
    readonly selectedEvent: TimelineEvent | null;
    readonly taskTitle: string | null;
    readonly onSelectEvent: (id: string) => void;
    readonly onClose: () => void;
}

export function TimelineStackPopover({
    openStackEventId,
    items,
    stackGroups,
    nodeBounds,
    selectedEvent,
    taskTitle,
    onSelectEvent,
    onClose,
}: TimelineStackPopoverProps): React.JSX.Element | null {
    const frontItem = items.find((i) => i.event.id === openStackEventId);
    if (!frontItem) return null;
    const group = stackGroups.get(openStackEventId);
    if (!group) return null;
    const bounds = nodeBounds[openStackEventId];
    if (!bounds) return null;

    const popoverLeft = bounds.left;
    const popoverTop = bounds.top + bounds.height + 6;
    const sortedGroup = [...group].sort(
        (a, b) => Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt),
    );

    return (
        <div className="stack-popover" style={{ left: `${popoverLeft}px`, top: `${popoverTop}px` }}>
            <div className="stack-popover-header">
                {KO_TIMELINE_STACKED_EVENTS(group.length)}
            </div>
            {sortedGroup.map((groupItem) => {
                const gt = getLaneTheme(groupItem.baseLane);
                return (
                    <button
                        key={groupItem.event.id}
                        className={cn(
                            "stack-popover-item",
                            groupItem.baseLane,
                            groupItem.event.id === selectedEvent?.id && "active",
                        )}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(groupItem.event.id);
                            onClose();
                        }}
                    >
                        <img
                            className={`stack-item-icon ${groupItem.baseLane}`}
                            src={gt.icon}
                            alt=""
                        />
                        <span className="stack-item-title">
                            {groupItem.event.kind === "task.start"
                                ? (taskTitle ?? groupItem.event.title)
                                : groupItem.event.title}
                        </span>
                        <span className="stack-item-time">
                            {formatRelativeTime(groupItem.event.createdAt)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
