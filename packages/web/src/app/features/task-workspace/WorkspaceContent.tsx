import type React from "react";
import type { TurnPartition } from "../../../types.js";
import { Timeline } from "../../components/Timeline.js";
import type { TimelineProps } from "../../features/timeline/types.js";
import { Button } from "../../components/ui/Button.js";
import type { WorkspaceState } from "./useWorkspace.js";

type TimelineEmbeddedProps = Pick<TimelineProps, "externalFiltersState" | "externalTimelineFilters">;

interface WorkspaceContentProps {
    readonly taskId: string;
    readonly workspace: WorkspaceState;
    readonly zoom: number;
    readonly onZoomChange: (z: number) => void;
    readonly embedded: boolean;
    readonly timelineEmbeddedProps: TimelineEmbeddedProps;
    readonly onNavigateBack: () => void;
    readonly turnPartition: TurnPartition | null;
    readonly focusedTurnGroupId: string | null;
    readonly onFocusTurnGroup: (groupId: string | null) => void;
}

export function WorkspaceContent({
    taskId,
    workspace,
    zoom,
    onZoomChange,
    embedded,
    timelineEmbeddedProps,
    onNavigateBack,
    turnPartition,
    focusedTurnGroupId,
    onFocusTurnGroup,
}: WorkspaceContentProps): React.JSX.Element {
    const {
        workspaceLoading, workspaceMissingTask,
        selectedTaskDetail, taskTimeline, nowMs,
        selectedTaskDisplayTitle, selectedTaskUsesDerivedTitle,
        observabilityStats,
        selectedEventId, selectedConnectorKey, selectedRuleId, showRuleGapsOnly,
        isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus,
        selectEvent, selectConnector, selectRule, selectTag, setShowRuleGapsOnly, resetFilters,
        startEditing, updateDraft, setTitleError, finishEditing,
        handleTaskStatusChange, handleTaskTitleSubmit,
    } = workspace;

    if (workspaceLoading) {
        return (
            <section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-[var(--shadow-1)]">
                <div className="text-center">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">Loading Workspace</p>
                    <h2 className="mt-2 text-[1.05rem] font-semibold text-[var(--text-1)]">{taskId}</h2>
                    <p className="mt-3 text-[0.88rem] leading-6 text-[var(--text-2)]">Fetching the task timeline and observability state from the local database.</p>
                </div>
            </section>
        );
    }

    if (workspaceMissingTask) {
        return (
            <section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-[var(--shadow-1)]">
                <div className="max-w-xl text-center">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">Task Not Found</p>
                    <h2 className="mt-2 text-[1.1rem] font-semibold text-[var(--text-1)]">{taskId}</h2>
                    <p className="mt-3 text-[0.88rem] leading-6 text-[var(--text-2)]">This task does not exist in the current local database.</p>
                    <div className="mt-5 flex justify-center">
                        <Button size="sm" onClick={onNavigateBack}>Back to Timeline</Button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)] min-h-[24rem] flex-1">
            <Timeline
                zoom={zoom}
                onZoomChange={onZoomChange}
                timeline={taskTimeline}
                taskTitle={selectedTaskDisplayTitle}
                taskWorkspacePath={selectedTaskDetail?.task.workspacePath}
                taskStatus={selectedTaskDetail?.task.status}
                taskUpdatedAt={selectedTaskDetail?.task.updatedAt}
                taskUsesDerivedTitle={selectedTaskUsesDerivedTitle}
                isEditingTaskTitle={isEditingTaskTitle}
                taskTitleDraft={taskTitleDraft}
                taskTitleError={taskTitleError}
                isSavingTaskTitle={isSavingTaskTitle}
                isUpdatingTaskStatus={isUpdatingTaskStatus}
                selectedEventId={selectedEventId}
                selectedConnectorKey={selectedConnectorKey}
                selectedRuleId={selectedRuleId}
                showRuleGapsOnly={showRuleGapsOnly}
                nowMs={nowMs}
                observabilityStats={observabilityStats}
                onSelectEvent={(id) => { selectConnector(null); selectEvent(id); }}
                onSelectConnector={(key) => { selectConnector(key); selectEvent(null); }}
                onStartEditTitle={() => { startEditing(selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? ""); }}
                onCancelEditTitle={() => { updateDraft(selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? ""); setTitleError(null); finishEditing(); }}
                onSubmitTitle={(e) => void handleTaskTitleSubmit(e, taskTitleDraft)}
                onTitleDraftChange={updateDraft}
                onClearFilters={() => { selectRule(null); selectTag(null); resetFilters(); }}
                onToggleRuleGap={setShowRuleGapsOnly}
                onClearRuleId={() => selectRule(null)}
                onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}
                embedded={embedded}
                turnPartition={turnPartition}
                focusedTurnGroupId={focusedTurnGroupId}
                onSelectTurnGroup={onFocusTurnGroup}
                {...timelineEmbeddedProps}
            />
        </section>
    );
}
