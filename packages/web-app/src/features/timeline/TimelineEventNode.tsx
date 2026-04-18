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

const MAX_BADGE_ICONS = 3;

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
    readonly tokenBadges?: readonly TimelineEvent[] | undefined;
    readonly onSelectEvent: (id: string) => void;
    readonly onOpenStack: (id: string | null) => void;
    readonly onRegisterNode: (id: string, node: HTMLElement | null) => void;
}

/** Marker that the PostToolUseFailure hook sets on failed tool events. */
function isFailedToolLayoutEvent(event: { kind: string; metadata: Record<string, unknown> }): boolean {
    if (event.kind !== "tool.used" && event.kind !== "agent.activity.logged") return false;
    const md = event.metadata;
    if (md["failed"] === true) return true;
    if (md["errored"] === true) return true;
    const status = md["status"];
    return typeof status === "string" && status.toLowerCase() === "failed";
}

/** Redacted thinking blocks have no readable body — only a cryptographic signature. */
function isRedactedThoughtLayoutEvent(event: { kind: string; metadata: Record<string, unknown> }): boolean {
    return event.kind === "thought.logged" && event.metadata["redacted"] === true;
}

export function TimelineEventNode({
    item,
    selectedEvent,
    selectedConnector,
    taskTitle,
    openStackEventId,
    stackGroups,
    tokenBadges,
    onSelectEvent,
    onOpenStack,
    onRegisterNode,
}: TimelineEventNodeProps): React.JSX.Element {
    const subtype = resolveEventSubtype(item.event);
    const stackGroup = stackGroups.get(item.event.id);
    const stackCount = stackGroup ? stackGroup.length - 1 : 0;
    const nodeTop = item.top + item.rowIndex * ROW_VERTICAL_OFFSET;
    const isActive = item.event.id === selectedEvent?.id;
    const linkedSourceId = selectedConnector?.source.id;
    const linkedTargetId = selectedConnector?.target.id;
    const isLinked =
        Boolean(selectedConnector) &&
        (item.event.id === linkedSourceId ||
            item.event.id === linkedTargetId);
    const isFailed = isFailedToolLayoutEvent(item.event);
    const isRedactedThought = isRedactedThoughtLayoutEvent(item.event);
    const signatureLength = typeof item.event.metadata["signatureLength"] === "number"
        ? item.event.metadata["signatureLength"]
        : undefined;

    return (
        <div
            key={item.event.id}
            role="button"
            tabIndex={0}
            className={cn(
                `event-node ${item.baseLane} kind-${item.event.kind.replace(/\./g, "-")}`,
                isActive && "active",
                isLinked && "linked",
                isFailed && "failed",
                isRedactedThought && "redacted-thought",
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
                {isFailed && (
                    <span
                        aria-label="Failed"
                        role="img"
                        title="Tool call failed"
                        className="event-failed-icon select-none"
                    >
                        ✕
                    </span>
                )}
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
            {isRedactedThought && (
                <div className="event-redacted-subtext">
                    cryptographic signature only
                    {signatureLength !== undefined && ` · ${signatureLength.toLocaleString()} chars`}
                </div>
            )}
            {tokenBadges && tokenBadges.length > 0 && (
                <div className="token-badge-row">
                    {tokenBadges.slice(0, MAX_BADGE_ICONS).map((te) => (
                        <button
                            key={te.id}
                            type="button"
                            className="token-badge"
                            title={te.body ?? te.title}
                            aria-label={`Token usage: ${te.title}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(te.id);
                            }}
                        >
                            💰
                        </button>
                    ))}
                    {tokenBadges.length > MAX_BADGE_ICONS && (
                        <button
                            type="button"
                            className="token-badge token-badge-overflow"
                            title={`${tokenBadges.length} API calls`}
                            aria-label={`${tokenBadges.length} API calls — click to inspect first`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(tokenBadges[MAX_BADGE_ICONS]!.id);
                            }}
                        >
                            +{tokenBadges.length - MAX_BADGE_ICONS}
                        </button>
                    )}
                </div>
            )}
            <div className="event-node-meta">
                <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
            </div>
        </div>
    );
}

/** Width of each event node in the timeline canvas, used for stack overlap detection. */
export { NODE_WIDTH };
