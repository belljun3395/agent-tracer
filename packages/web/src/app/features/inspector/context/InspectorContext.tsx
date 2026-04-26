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
    ModelSummary,
    TaskDetailResponse,
    TimelineConnector,
    TimelineEventRecord,
    TurnGroup,
    TurnPartition,
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
    readonly taskModelSummary?: ModelSummary | undefined;
    // Selection state
    readonly selectedEvent: TimelineEventRecord | null;
    readonly selectedConnector: InspectorSelectedConnector | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly selectedTag: string | null;
    readonly selectedRuleId: string | null;
    // Handlers
    readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
    readonly onSelectTag: (tag: string | null) => void;
    readonly onSelectRule: (ruleId: string | null) => void;
    readonly onSelectEvent?: ((eventId: string) => void) | undefined;
    // Turn partition (optional — only present when a task is loaded)
    readonly turnPartition?: TurnPartition | null;
    readonly focusedTurnGroupId?: string | null;
    readonly onFocusTurnGroup?: ((groupId: string | null) => void) | undefined;
    readonly onMergeTurnGroup?: ((groupId: string) => Promise<void>) | undefined;
    readonly onSplitTurnGroup?: ((groupId: string, atTurnIndex: number) => Promise<void>) | undefined;
    readonly onToggleTurnGroupVisibility?: ((groupId: string) => Promise<void>) | undefined;
    readonly onRenameTurnGroup?: ((groupId: string, label: string | null) => Promise<void>) | undefined;
    readonly onResetTurnPartition?: (() => Promise<void>) | undefined;
    readonly turnPartitionSaving?: boolean;
    readonly focusedGroup?: TurnGroup | null;
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
