import type React from "react";
import {
    formatRelativeTime,
    NODE_WIDTH,
    resolveEventSubtype,
    ROW_VERTICAL_OFFSET,
    type TimelineConnector,
    type TimelineEvent,
    type TimelineItemLayout,
} from "@monitor/web-domain";
import { cn } from "../../lib/ui/cn.js";

interface TimelineEventNodeProps {
    readonly item: TimelineItemLayout;
    readonly selectedEvent: TimelineEvent | null;
    readonly selectedConnector: {
        readonly connector: TimelineConnector;
        readonly source: TimelineEvent;
        readonly target: TimelineEvent;
    } | null;
    readonly taskTitle: string | null;
    readonly openStackEventId: string | null;
    readonly stackGroups: ReadonlyMap<string, readonly TimelineItemLayout[]>;
    readonly onSelectEvent: (id: string) => void;
    readonly onOpenStack: (id: string | null) => void;
    readonly onRegisterNode: (id: string, node: HTMLElement | null) => void;
}

export function TimelineEventNode({
    item,
    selectedEvent,
    selectedConnector,
    taskTitle,
    openStackEventId,
    stackGroups,
    onSelectEvent,
    onOpenStack,
    onRegisterNode,
}: TimelineEventNodeProps): React.JSX.Element {
    const subtype = resolveEventSubtype(item.event);
    const stackGroup = stackGroups.get(item.event.id);
    const stackCount = stackGroup ? stackGroup.length - 1 : 0;
    const nodeTop = item.top + item.rowIndex * ROW_VERTICAL_OFFSET;
    const isActive = item.event.id === selectedEvent?.id;
    const isLinked =
        Boolean(selectedConnector) &&
        (item.event.id === selectedConnector!.source.id ||
            item.event.id === selectedConnector!.target.id);

    return (
        <div
            key={item.event.id}
            role="button"
            tabIndex={0}
            className={cn(
                `event-node ${item.baseLane} kind-${item.event.kind.replace(/\./g, "-")}`,
                isActive && "active",
                isLinked && "linked",
                item.rowIndex > 0 && "stacked-behind",
            )}
            onClick={() => {
                onSelectEvent(item.event.id);
                onOpenStack(null);
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectEvent(item.event.id);
                    onOpenStack(null);
                }
            }}
            ref={(node) => {
                onRegisterNode(item.event.id, node);
            }}
            style={{ left: `${item.left}px`, top: `${nodeTop}px` }}
        >
            <div className="event-node-header">
                <span className="event-node-dot" />
                <span className="event-lane-tag">{item.baseLane}</span>
                {subtype?.icon && (
                    <span
                        aria-label={subtype.label}
                        className="text-[0.75rem] opacity-70 select-none leading-none"
                        role="img"
                        title={subtype.label}
                    >
                        {subtype.icon}
                    </span>
                )}
                {stackCount > 0 && (
                    <button
                        className="stack-badge-btn"
                        aria-label={`${stackCount + 1} overlapping events`}
                        title={`${stackCount + 1} overlapping events`}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenStack(
                                openStackEventId === item.event.id ? null : item.event.id,
                            );
                        }}
                    >
                        +{stackCount}
                    </button>
                )}
            </div>
            <strong>
                {item.event.kind === "task.start"
                    ? (taskTitle ?? item.event.title)
                    : item.event.title}
            </strong>
            <div className="event-node-meta">
                <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
            </div>
        </div>
    );
}

/** Width of each event node in the timeline canvas, used for stack overlap detection. */
export { NODE_WIDTH };
