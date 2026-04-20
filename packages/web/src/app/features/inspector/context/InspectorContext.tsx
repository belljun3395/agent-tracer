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
    TimelineEventRecord,
} from "../../../../types.js";

interface InspectorSelectedConnector {
    readonly connector: TimelineConnector;
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}

interface InspectorContextValue {
    // Task data
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskTitle: string | null;
    readonly taskObservability: TaskObservabilityResponse | null;
    readonly taskModelSummary?: ModelSummary | undefined;
    // Selection state
    readonly selectedEvent: TimelineEventRecord | null;
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
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
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

export function useOptionalInspectorContext(): InspectorContextValue | null {
    return useContext(InspectorContext);
}
