import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TaskId } from "~domain/monitoring.js";
import { EventId } from "~domain/monitoring.js";
import { buildTaskWorkspaceSelection } from "~app/lib/taskWorkspace.js";
import { updateEventDisplayTitle } from "~io/api.js";
import { useTaskDetailQuery } from "~state/server/queries.js";
import { monitorQueryKeys } from "~state/server/queryKeys.js";
import { useSelectionStore } from "~state/ui/UiStoreProvider.js";
import { useTurnPartitionContext } from "~state/TurnPartitionProvider.js";
import { useQueryClient } from "@tanstack/react-query";
import { InspectorProvider } from "../features/inspector/context/InspectorContext.js";
import { cn } from "../lib/ui/cn.js";
import { EventInspector } from "./EventInspector.js";
import { QuickInspector } from "./QuickInspector.js";

interface InspectorContainerProps {
    readonly isStackedDashboard: boolean;
    readonly isInspectorCollapsed: boolean;
    readonly selectedTaskDisplayTitle: string | null;
    readonly onToggleCollapse: () => void;
    readonly onInspectorResizeStart?: ((event: React.PointerEvent<HTMLDivElement>) => void) | undefined;
}

export function InspectorContainer({
    isStackedDashboard,
    isInspectorCollapsed,
    selectedTaskDisplayTitle,
    onToggleCollapse,
}: InspectorContainerProps): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectedEventId = useSelectionStore((s) => s.selectedEventId);
    const selectedConnectorKey = useSelectionStore((s) => s.selectedConnectorKey);
    const selectedTag = useSelectionStore((s) => s.selectedTag);
    const selectedRuleId = useSelectionStore((s) => s.selectedRuleId);
    const showRuleGapsOnly = useSelectionStore((s) => s.showRuleGapsOnly);
    const focusedTurnGroupId = useSelectionStore((s) => s.focusedTurnGroupId);
    const selectTag = useSelectionStore((s) => s.selectTag);
    const selectRule = useSelectionStore((s) => s.selectRule);
    const setShowRuleGapsOnly = useSelectionStore((s) => s.setShowRuleGapsOnly);
    const onFocusTurnGroup = useSelectionStore((s) => s.focusTurnGroup);

    const [isFullInspector, setIsFullInspector] = useState(false);

    const { data: taskDetail } = useTaskDetailQuery(
        selectedTaskId != null ? (selectedTaskId as TaskId) : null
    );
    const queryClient = useQueryClient();

    const taskTimeline = taskDetail?.timeline ?? [];
    const workspaceSelection = useMemo(
        () =>
            buildTaskWorkspaceSelection({
                timeline: taskTimeline,
                selectedConnectorKey,
                selectedEventId,
                selectedRuleId,
                selectedTag,
                showRuleGapsOnly,
                taskDisplayTitle: selectedTaskDisplayTitle,
            }),
        [selectedConnectorKey, selectedEventId, selectedRuleId, selectedTag, selectedTaskDisplayTitle, showRuleGapsOnly, taskTimeline]
    );
    const { selectedConnector, selectedEvent, selectedEventDisplayTitle, modelSummary } = workspaceSelection;

    const onUpdateEventDisplayTitle = useCallback(async (eventId: string, displayTitle: string | null): Promise<void> => {
        if (!selectedTaskId) return;
        await updateEventDisplayTitle(EventId(eventId), displayTitle ?? "");
        await queryClient.invalidateQueries({
            queryKey: monitorQueryKeys.taskDetail(selectedTaskId as TaskId),
        });
    }, [selectedTaskId, queryClient]);

    const onSelectRule = useCallback((ruleId: string | null): void => {
        setShowRuleGapsOnly(false);
        selectRule(ruleId);
    }, [setShowRuleGapsOnly, selectRule]);

    const partitionCtx = useTurnPartitionContext();
    const turnPartition = partitionCtx?.partition ?? null;
    const turnPartitionSaving = partitionCtx?.isSaving ?? false;
    const onMergeTurnGroup = partitionCtx?.mergeNext;
    const onSplitTurnGroup = partitionCtx?.split;
    const onToggleTurnGroupVisibility = partitionCtx?.toggleVisibility;
    const onRenameTurnGroup = partitionCtx?.rename;
    const onResetTurnPartition = partitionCtx?.reset;
    const focusedGroup = turnPartition?.groups.find((g) => g.id === focusedTurnGroupId) ?? null;

    const panelToggle = (
        <button
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-transparent px-2 text-[0.72rem] font-semibold text-[var(--text-3)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
            onClick={() => setIsFullInspector((v) => !v)}
            title={isFullInspector ? "Quick Inspect" : "Full inspector"}
            type="button"
        >
            <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="13">
                {isFullInspector ? (
                    <>
                        <polyline points="4 14 10 14 10 20"/>
                        <polyline points="20 10 14 10 14 4"/>
                        <line x1="10" x2="3" y1="14" y2="21"/>
                        <line x1="21" x2="14" y1="3" y2="10"/>
                    </>
                ) : (
                    <>
                        <polyline points="15 3 21 3 21 9"/>
                        <polyline points="9 21 3 21 3 15"/>
                        <line x1="21" x2="14" y1="3" y2="10"/>
                        <line x1="3" x2="10" y1="21" y2="14"/>
                    </>
                )}
            </svg>
            {isFullInspector ? "Quick" : "Full"}
        </button>
    );

    const inspectorProviderValue = {
        taskDetail: taskDetail ?? null,
        selectedTaskTitle: selectedTaskDisplayTitle,
        taskModelSummary: modelSummary,
        selectedEvent,
        selectedConnector,
        selectedEventDisplayTitle,
        selectedTag,
        selectedRuleId,
        onUpdateEventDisplayTitle,
        onSelectTag: selectTag,
        onSelectRule,
        turnPartition,
        focusedTurnGroupId,
        focusedGroup,
        onFocusTurnGroup,
        onMergeTurnGroup,
        onSplitTurnGroup,
        onToggleTurnGroupVisibility,
        onRenameTurnGroup,
        onResetTurnPartition,
        turnPartitionSaving,
    };

    return (
        <div
            className={cn("relative flex min-h-0 min-w-0 flex-col", isStackedDashboard && "order-3")}
            data-testid="inspector-container"
        >
            <InspectorProvider value={inspectorProviderValue}>
                {isFullInspector ? (
                    <EventInspector
                        className={cn(isStackedDashboard && "min-h-[20rem]")}
                        showCollapseControl={!isStackedDashboard}
                        isCollapsed={isInspectorCollapsed}
                        onToggleCollapse={onToggleCollapse}
                        headerExtra={panelToggle}
                    />
                ) : (
                    <QuickInspector
                        className={cn(isStackedDashboard && "min-h-[20rem]")}
                        showCollapseControl={!isStackedDashboard}
                        isCollapsed={isInspectorCollapsed}
                        onToggleCollapse={onToggleCollapse}
                        headerExtra={panelToggle}
                    />
                )}
            </InspectorProvider>
        </div>
    );
}
