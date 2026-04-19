import type React from "react";
import { useCallback, useMemo } from "react";
import type { TaskId } from "../../types.js";
import { EventId } from "../../types.js";
import { buildTaskWorkspaceSelection } from "../../types.js";
import { createBookmark, updateEventDisplayTitle } from "../../io.js";
import {
    monitorQueryKeys,
    useBookmarksQuery,
    useSelectionStore,
    useTaskDetailQuery,
    useTaskObservability
} from "../../state.js";
import { useQueryClient } from "@tanstack/react-query";
import { InspectorProvider } from "../features/inspector/context/InspectorContext.js";
import { cn } from "../lib/ui/cn.js";
import { QuickInspector } from "./QuickInspector.js";

interface InspectorContainerProps {
    readonly isStackedDashboard: boolean;
    readonly isInspectorCollapsed: boolean;
    readonly selectedTaskDisplayTitle: string | null;
    readonly onToggleCollapse: () => void;
    readonly onInspectorResizeStart?: ((event: React.PointerEvent<HTMLDivElement>) => void) | undefined;
    readonly onOpenTaskWorkspace?: (() => void) | undefined;
}

export function InspectorContainer({
    isStackedDashboard,
    isInspectorCollapsed,
    selectedTaskDisplayTitle,
    onToggleCollapse,
    onOpenTaskWorkspace,
}: InspectorContainerProps): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectedEventId = useSelectionStore((s) => s.selectedEventId);
    const selectedConnectorKey = useSelectionStore((s) => s.selectedConnectorKey);
    const selectedTag = useSelectionStore((s) => s.selectedTag);
    const selectedRuleId = useSelectionStore((s) => s.selectedRuleId);
    const showRuleGapsOnly = useSelectionStore((s) => s.showRuleGapsOnly);
    const selectTag = useSelectionStore((s) => s.selectTag);
    const selectRule = useSelectionStore((s) => s.selectRule);
    const setShowRuleGapsOnly = useSelectionStore((s) => s.setShowRuleGapsOnly);

    const { data: taskDetail } = useTaskDetailQuery(
        selectedTaskId != null ? (selectedTaskId as TaskId) : null
    );
    const { data: bookmarksData } = useBookmarksQuery();
    const bookmarks = bookmarksData?.bookmarks ?? [];
    const { taskObservability } = useTaskObservability(selectedTaskId);
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
    const selectedTaskBookmark =
        selectedTaskId ? (bookmarks.find((b) => b.taskId === selectedTaskId && !b.eventId) ?? null) : null;
    const selectedEventBookmark = selectedEvent
        ? (bookmarks.find((b) => b.eventId === selectedEvent.id) ?? null)
        : null;

    const onCreateTaskBookmark = useCallback((): void => {
        if (!selectedTaskId) return;
        void createBookmark({ taskId: selectedTaskId as TaskId })
            .then(() => queryClient.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() }));
    }, [selectedTaskId, queryClient]);

    const onCreateEventBookmark = useCallback((): void => {
        if (!selectedEvent || !selectedTaskId) return;
        void createBookmark({
            taskId: selectedTaskId as TaskId,
            eventId: EventId(selectedEvent.id),
            title: selectedEventDisplayTitle ?? selectedEvent.title,
        }).then(() => queryClient.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() }));
    }, [selectedEvent, selectedTaskId, selectedEventDisplayTitle, queryClient]);

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

    return (
        <div className={cn("relative flex min-h-0 min-w-0 flex-col", isStackedDashboard && "order-3")}>
            <InspectorProvider value={{
                taskDetail: taskDetail ?? null,
                selectedTaskTitle: selectedTaskDisplayTitle,
                taskObservability,
                taskModelSummary: modelSummary,
                selectedEvent,
                selectedConnector,
                selectedEventDisplayTitle,
                selectedTaskBookmark,
                selectedEventBookmark,
                selectedTag,
                selectedRuleId,
                onCreateTaskBookmark,
                onCreateEventBookmark,
                onUpdateEventDisplayTitle,
                onSelectTag: selectTag,
                onSelectRule,
                ...(onOpenTaskWorkspace !== undefined ? { onOpenTaskWorkspace } : {}),
            }}>
                <QuickInspector
                    className={cn(isStackedDashboard && "min-h-[20rem]")}
                    showCollapseControl={!isStackedDashboard}
                    isCollapsed={isInspectorCollapsed}
                    onToggleCollapse={onToggleCollapse}
                />
            </InspectorProvider>
        </div>
    );
}
