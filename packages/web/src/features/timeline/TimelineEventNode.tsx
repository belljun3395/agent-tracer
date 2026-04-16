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
    const questionPhase =
        typeof item.event.metadata["questionPhase"] === "string"
            ? item.event.metadata["questionPhase"]
            : undefined;
    const todoState =
        typeof item.event.metadata["todoState"] === "string"
            ? item.event.metadata["todoState"]
            : undefined;
    const relationLabel =
        typeof item.event.metadata["relationLabel"] === "string"
            ? item.event.metadata["relationLabel"]
            : typeof item.event.metadata["relationType"] === "string"
              ? String(item.event.metadata["relationType"]).replace(/_/g, " ")
              : undefined;
    const activityType =
        typeof item.event.metadata["activityType"] === "string"
            ? item.event.metadata["activityType"]
            : undefined;
    const agentName =
        typeof item.event.metadata["agentName"] === "string"
            ? item.event.metadata["agentName"]
            : undefined;
    const skillName =
        typeof item.event.metadata["skillName"] === "string"
            ? item.event.metadata["skillName"]
            : undefined;
    const mcpTool =
        typeof item.event.metadata["mcpTool"] === "string"
            ? item.event.metadata["mcpTool"]
            : undefined;
    const workItemId =
        typeof item.event.metadata["workItemId"] === "string"
            ? item.event.metadata["workItemId"]
            : typeof item.event.metadata["todoId"] === "string"
              ? item.event.metadata["todoId"]
              : undefined;
    const subtype = resolveEventSubtype(item.event);
    const stackGroup = stackGroups.get(item.event.id);
    const stackCount = stackGroup ? stackGroup.length - 1 : 0;
    const nodeTop = item.top + item.rowIndex * ROW_VERTICAL_OFFSET;
    const semanticChips = [
        subtype ? { label: subtype.label, subtle: false } : null,
        activityType ? { label: activityType.replace(/_/g, " "), subtle: false } : null,
        relationLabel ? { label: relationLabel, subtle: true } : null,
        agentName ? { label: agentName, subtle: true } : null,
        skillName
            ? { label: `skill:${skillName}`, subtle: true }
            : !skillName && mcpTool
              ? { label: `mcp:${mcpTool}`, subtle: true }
              : null,
        workItemId ? { label: `work:${workItemId}`, subtle: true } : null,
        item.event.kind === "assistant.response" ? { label: "response", subtle: false } : null,
        item.event.kind === "question.logged" && questionPhase
            ? { label: questionPhase, subtle: false }
            : null,
        item.event.kind === "todo.logged" && todoState
            ? { label: todoState.replace("_", " "), subtle: false }
            : null,
    ].filter(
        (chip): chip is { readonly label: string; readonly subtle: boolean } => chip !== null,
    );
    const visibleSemanticChips = semanticChips.slice(0, 2);
    const hiddenSemanticChipCount = Math.max(semanticChips.length - visibleSemanticChips.length, 0);
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
                {visibleSemanticChips.length > 0 && (
                    <div className="event-node-chips">
                        {visibleSemanticChips.map((chip) => (
                            <span
                                key={chip.label}
                                className={cn("event-semantic-tag", chip.subtle && "subtle")}
                            >
                                {chip.label}
                            </span>
                        ))}
                        {hiddenSemanticChipCount > 0 && (
                            <span className="event-semantic-tag subtle">
                                +{hiddenSemanticChipCount}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Width of each event node in the timeline canvas, used for stack overlap detection. */
export { NODE_WIDTH };
