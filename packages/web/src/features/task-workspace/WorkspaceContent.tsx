import type React from "react";
import type { PanelTabId } from "../../components/EventInspector.js";
import { EventInspector } from "../../components/EventInspector.js";
import { Timeline } from "../../components/Timeline.js";
import type { TimelineProps } from "../../features/timeline/types.js";
import { InspectorProvider } from "../../features/inspector/context/InspectorContext.js";
import { Button } from "../../components/ui/Button.js";
import { cn } from "../../lib/ui/cn.js";
import type { WorkspaceState } from "./useWorkspace.js";
import { WorkspaceReviewPanel } from "./WorkspaceReviewPanel.js";

type TimelineEmbeddedProps = Pick<TimelineProps, "externalControlsState" | "externalFiltersState">;

interface WorkspaceContentProps {
    readonly taskId: string;
    readonly workspace: WorkspaceState;
    readonly zoom: number;
    readonly onZoomChange: (z: number) => void;
    readonly activeTab: PanelTabId;
    readonly onActiveTabChange: (tab: PanelTabId) => void;
    readonly isStackedWorkspace: boolean;
    readonly workspaceLayoutStyle: React.CSSProperties | undefined;
    readonly onInspectorResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
    readonly embedded: boolean;
    readonly timelineEmbeddedProps: TimelineEmbeddedProps;
    readonly reviewerNote: string;
    readonly reviewerId: string;
    readonly isSubmittingRuleReview: boolean;
    readonly onReviewerNoteChange: (note: string) => void;
    readonly onReviewerIdChange: (id: string) => void;
    readonly onNavigateBack: () => void;
}

export function WorkspaceContent({
    taskId,
    workspace,
    zoom,
    onZoomChange,
    activeTab,
    onActiveTabChange,
    isStackedWorkspace,
    workspaceLayoutStyle,
    onInspectorResizeStart,
    embedded,
    timelineEmbeddedProps,
    reviewerNote,
    reviewerId,
    isSubmittingRuleReview,
    onReviewerNoteChange,
    onReviewerIdChange,
    onNavigateBack,
}: WorkspaceContentProps): React.JSX.Element {
    const {
        workspaceLoading, workspaceMissingTask,
        selectedTaskDetail, taskTimeline, taskObservability, nowMs,
        selectedTaskDisplayTitle, selectedTaskUsesDerivedTitle,
        observabilityStats, modelSummary,
        selectedConnector, selectedEvent, selectedEventDisplayTitle,
        selectedTaskBookmark, selectedEventBookmark,
        selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly,
        isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus,
        selectEvent, selectConnector, selectRule, selectTag, setShowRuleGapsOnly, resetFilters,
        startEditing, updateDraft, setTitleError, finishEditing,
        handleTaskStatusChange, handleTaskTitleSubmit,
        handleCreateTaskBookmark, handleCreateEventBookmark, handleUpdateEventDisplayTitle,
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
        <div className="grid flex-1 min-h-0 gap-3" style={workspaceLayoutStyle}>
            <section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]", "min-h-[24rem]")}>
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
                    selectedTag={selectedTag}
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
                    onClearTag={() => selectTag(null)}
                    onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}
                    embedded={embedded}
                    {...timelineEmbeddedProps}
                />
            </section>

            <div className="relative flex min-h-0 min-w-0 flex-col">
                <WorkspaceReviewPanel
                    workspace={workspace}
                    reviewerNote={reviewerNote}
                    reviewerId={reviewerId}
                    isSubmittingRuleReview={isSubmittingRuleReview}
                    onReviewerNoteChange={onReviewerNoteChange}
                    onReviewerIdChange={onReviewerIdChange}
                />
                {!isStackedWorkspace && (
                    <div
                        aria-label="Resize workspace inspector panel"
                        aria-orientation="vertical"
                        className="inspector-resizer absolute left-[-9px] top-2 bottom-2 z-10 w-3 cursor-col-resize before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--border)_74%,transparent)] before:transition-colors hover:before:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]"
                        onPointerDown={onInspectorResizeStart}
                        role="separator"
                    />
                )}
                <InspectorProvider value={{
                    taskDetail: selectedTaskDetail ?? null,
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
                    onCreateTaskBookmark: () => void handleCreateTaskBookmark(),
                    onCreateEventBookmark: () => void handleCreateEventBookmark(),
                    onSelectRule: (ruleId) => { setShowRuleGapsOnly(false); selectRule(ruleId); },
                    onSelectTag: selectTag,
                    onUpdateEventDisplayTitle: handleUpdateEventDisplayTitle,
                }}>
                    <EventInspector
                        activeTab={activeTab}
                        className="min-h-[24rem]"
                        isCollapsed={false}
                        showCollapseControl={false}
                        onActiveTabChange={onActiveTabChange}
                        onToggleCollapse={() => {}}
                    />
                </InspectorProvider>
            </div>
        </div>
    );
}
