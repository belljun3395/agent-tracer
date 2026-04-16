/**
 * InspectorContext — holds the domain state for the inspector panel tree,
 * eliminating 18+ props that were previously drilled from callers through
 * EventInspector down to each tab component.
 *
 * Usage:
 *   <InspectorProvider value={domainState}>
 *     <EventInspector isCollapsed={...} onToggleCollapse={...} />
 *   </InspectorProvider>
 */
import type React from "react";
import { createContext, useContext } from "react";
import type {
    BookmarkRecord,
    ModelSummary,
    TaskDetailResponse,
    TaskObservabilityResponse,
    TimelineConnector,
    TimelineEvent,
} from "@monitor/web-domain";

export interface InspectorSelectedConnector {
    readonly connector: TimelineConnector;
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
}

/** Domain state consumed by inspector tabs. All callers provide this via InspectorProvider. */
export interface InspectorContextValue {
    // Task data
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskTitle: string | null;
    readonly taskObservability: TaskObservabilityResponse | null;
    readonly taskModelSummary?: ModelSummary | undefined;
    // Selection state
    readonly selectedEvent: TimelineEvent | null;
    readonly selectedConnector: InspectorSelectedConnector | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly selectedTaskBookmark: BookmarkRecord | null;
    readonly selectedEventBookmark: BookmarkRecord | null;
    readonly selectedTag: string | null;
    readonly selectedRuleId: string | null;
    // Handlers
    readonly onCreateTaskBookmark: () => void;
    readonly onCreateEventBookmark: () => void;
    readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
    readonly onSelectTag: (tag: string | null) => void;
    readonly onSelectRule: (ruleId: string | null) => void;
    readonly onOpenTaskWorkspace?: (() => void) | undefined;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);
InspectorContext.displayName = "InspectorContext";

export function InspectorProvider({
    value,
    children,
}: {
    readonly value: InspectorContextValue;
    readonly children: React.ReactNode;
}): React.JSX.Element {
    return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
}

export function useInspectorContext(): InspectorContextValue {
    const ctx = useContext(InspectorContext);
    if (!ctx) throw new Error("useInspectorContext must be used inside <InspectorProvider>");
    return ctx;
}

/** Returns context if available, null otherwise. Use in EventInspector to support both patterns. */
export function useOptionalInspectorContext(): InspectorContextValue | null {
    return useContext(InspectorContext);
}
