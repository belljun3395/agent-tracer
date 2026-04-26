import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WorkspaceContent } from "./WorkspaceContent.js";
import { WorkspaceHeader } from "./WorkspaceHeader.js";
import { WorkspaceReviewPanel } from "./WorkspaceReviewPanel.js";
import { useWorkspace } from "./useWorkspace.js";
import { normalizeWorkspaceTab, REVIEWER_ID_STORAGE_KEY, WORKSPACE_INSPECTOR_DEFAULT_WIDTH, WORKSPACE_INSPECTOR_MAX_WIDTH, WORKSPACE_INSPECTOR_MIN_WIDTH, WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY } from "./constants.js";
import type { TimelineProps } from "../timeline/types.js";
import { writeSearchParam } from "../../shared/lib/urlState.js";
import { InspectorProvider } from "../inspector/context/InspectorContext.js";
import { EventInspector } from "../../components/EventInspector.js";
import { useTurnPartition } from "../../../state.js";

export function TaskWorkspace({ taskId, embedded = false, externalFiltersState, externalTimelineFilters }: {
    readonly taskId: string;
    readonly embedded?: boolean;
    readonly externalFiltersState?: TimelineProps["externalFiltersState"];
    readonly externalTimelineFilters?: TimelineProps["externalTimelineFilters"];
}): React.JSX.Element {
    const workspace = useWorkspace(taskId);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [reviewerNote, setReviewerNote] = useState("");
    const [isSubmittingRuleReview, setIsSubmittingRuleReview] = useState(false);
    const [reviewerId, setReviewerId] = useState(() => {
        try { return window.localStorage.getItem(REVIEWER_ID_STORAGE_KEY) ?? "local-reviewer"; } catch { return "local-reviewer"; }
    });
    const [zoom, setZoom] = useState(1.1);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const [isWorkspaceFiltersOpen, setIsWorkspaceFiltersOpen] = useState(false);
    const [workspaceFiltersPos, setWorkspaceFiltersPos] = useState({ top: 0, right: 0 });
    const workspaceFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
        try {
            const raw = window.localStorage.getItem(WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY);
            if (!raw) return WORKSPACE_INSPECTOR_DEFAULT_WIDTH;
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isFinite(parsed)) return WORKSPACE_INSPECTOR_DEFAULT_WIDTH;
            return Math.max(WORKSPACE_INSPECTOR_MIN_WIDTH, Math.min(WORKSPACE_INSPECTOR_MAX_WIDTH, parsed));
        } catch { return WORKSPACE_INSPECTOR_DEFAULT_WIDTH; }
    });

    const {
        partition: turnPartition, isSaving: turnPartitionSaving,
        mergeNext: onMergeTurnGroup, split: onSplitTurnGroup,
        toggleVisibility: onToggleTurnGroupVisibility, rename: onRenameTurnGroup,
        reset: onResetTurnPartition,
    } = useTurnPartition(taskId, workspace.taskTimeline);
    const [focusedTurnGroupId, setFocusedTurnGroupId] = useState<string | null>(null);
    const onFocusTurnGroup = useCallback((groupId: string | null) => {
        setFocusedTurnGroupId((current) => (current === groupId ? null : groupId));
    }, []);
    const focusedGroup = turnPartition?.groups.find((g) => g.id === focusedTurnGroupId) ?? null;

    useEffect(() => {
        try { window.localStorage.setItem(REVIEWER_ID_STORAGE_KEY, reviewerId); } catch { /* unavailable */ }
    }, [reviewerId]);
    useEffect(() => {
        try { window.localStorage.setItem(WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorWidth)); } catch { /* unavailable */ }
    }, [inspectorWidth]);
    useEffect(() => {
        const handler = (): void => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    const activeTab = useMemo(() => normalizeWorkspaceTab(searchParams.get("tab")), [searchParams]);

    const isStackedWorkspace = viewportWidth < 1024;
    const workspaceLayoutStyle = useMemo(
        () => (isStackedWorkspace ? undefined : ({ gridTemplateColumns: `minmax(0, 1fr) ${inspectorWidth}px` } as React.CSSProperties)),
        [inspectorWidth, isStackedWorkspace]
    );

    const handleInspectorResizeStart = useCallback(
        (event: React.PointerEvent<HTMLDivElement>): void => {
            if (event.button !== 0 || isStackedWorkspace) return;
            const startX = event.clientX;
            const startWidth = inspectorWidth;
            const onMove = (e: PointerEvent): void => {
                const next = Math.max(WORKSPACE_INSPECTOR_MIN_WIDTH, Math.min(WORKSPACE_INSPECTOR_MAX_WIDTH, Math.round(startWidth + (startX - e.clientX))));
                setInspectorWidth(next);
            };
            const onUp = (): void => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                document.body.classList.remove("is-resizing-inspector");
            };
            document.body.classList.add("is-resizing-inspector");
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
            event.preventDefault();
        },
        [inspectorWidth, isStackedWorkspace]
    );

    const handleActiveTabChange = useCallback(
        (tab: string): void => {
            setSearchParams((prev) => writeSearchParam(prev, "tab", tab), { replace: true });
        },
        [setSearchParams]
    );

    const handleRuleReviewWithState = useCallback(
        async (outcome: "approved" | "rejected" | "bypassed"): Promise<void> => {
            setIsSubmittingRuleReview(true);
            try {
                await workspace.handleRuleReview(outcome, reviewerId, reviewerNote);
                setReviewerNote("");
            } finally {
                setIsSubmittingRuleReview(false);
            }
        },
        [workspace, reviewerId, reviewerNote]
    );

    const resolvedExternalFiltersState = externalFiltersState ?? {
        isOpen: isWorkspaceFiltersOpen,
        setIsOpen: setIsWorkspaceFiltersOpen,
        popoverPos: workspaceFiltersPos,
        setPopoverPos: setWorkspaceFiltersPos,
        buttonRef: workspaceFiltersButtonRef,
    };

    const timelineEmbeddedProps = embedded ? {
        externalFiltersState: resolvedExternalFiltersState,
        ...(externalTimelineFilters !== undefined ? { externalTimelineFilters } : {}),
    } : {};

    const navigateBack = useCallback(() => void navigate(`/?task=${encodeURIComponent(taskId)}`), [navigate, taskId]);

    const inspectorProviderValue = {
        taskDetail: workspace.selectedTaskDetail ?? null,
        selectedTaskTitle: workspace.selectedTaskDisplayTitle,
        taskObservability: workspace.taskObservability,
        taskModelSummary: workspace.modelSummary,
        selectedEvent: workspace.selectedEvent,
        selectedConnector: workspace.selectedConnector,
        selectedEventDisplayTitle: workspace.selectedEventDisplayTitle,
        selectedTag: workspace.selectedTag,
        selectedRuleId: workspace.selectedRuleId,
        onSelectRule: (ruleId: string | null) => { workspace.setShowRuleGapsOnly(false); workspace.selectRule(ruleId); },
        onSelectEvent: (eventId: string | null) => { workspace.selectConnector(null); workspace.selectEvent(eventId); },
        onSelectTag: workspace.selectTag,
        onUpdateEventDisplayTitle: workspace.handleUpdateEventDisplayTitle,
        turnPartition,
        focusedTurnGroupId,
        onFocusTurnGroup,
        onMergeTurnGroup,
        onSplitTurnGroup,
        onToggleTurnGroupVisibility,
        onRenameTurnGroup,
        onResetTurnPartition,
        turnPartitionSaving,
        focusedGroup,
    };

    const sharedContentProps = {
        taskId,
        workspace,
        zoom,
        onZoomChange: setZoom,
        embedded,
        timelineEmbeddedProps,
        onNavigateBack: navigateBack,
        turnPartition,
        focusedTurnGroupId,
        onFocusTurnGroup,
    };

    const resizeHandle = !isStackedWorkspace ? (
        <div
            aria-label="Resize workspace inspector panel"
            aria-orientation="vertical"
            className="inspector-resizer absolute left-[-9px] top-2 bottom-2 z-10 w-3 cursor-col-resize before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--border)_74%,transparent)] before:transition-colors hover:before:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]"
            onPointerDown={handleInspectorResizeStart}
            role="separator"
        />
    ) : null;

    if (embedded) {
        return (
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <WorkspaceHeader
                        embedded={true}
                        taskId={taskId}
                        workspace={workspace}
                        isSubmittingRuleReview={isSubmittingRuleReview}
                        onRuleReview={(outcome) => void handleRuleReviewWithState(outcome)}
                        onNavigateDashboard={navigateBack}
                        embeddedExtras={{
                            showFiltersButton: externalFiltersState === undefined,
                            ...(externalFiltersState === undefined ? {
                                isWorkspaceFiltersOpen,
                                workspaceFiltersButtonRef,
                                onWorkspaceFiltersToggle: () => {
                                    if (workspaceFiltersButtonRef.current) {
                                        const rect = workspaceFiltersButtonRef.current.getBoundingClientRect();
                                        setWorkspaceFiltersPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                    }
                                    setIsWorkspaceFiltersOpen((v) => !v);
                                },
                            } : { showFiltersButton: false }),
                        }}
                    />
                    <main className="flex flex-1 min-h-0 flex-col gap-3 p-3">
                        <WorkspaceContent {...sharedContentProps} />
                    </main>
                </div>
                <div
                    className="relative flex min-h-0 min-w-0 flex-col"
                    style={isStackedWorkspace ? undefined : { width: inspectorWidth }}
                >
                    {resizeHandle}
                    <WorkspaceReviewPanel
                        workspace={workspace}
                        reviewerNote={reviewerNote}
                        reviewerId={reviewerId}
                        isSubmittingRuleReview={isSubmittingRuleReview}
                        onReviewerNoteChange={setReviewerNote}
                        onReviewerIdChange={setReviewerId}
                    />
                    <InspectorProvider value={inspectorProviderValue}>
                        <EventInspector
                            activeTab={activeTab}
                            isCollapsed={false}
                            showCollapseControl={false}
                            onActiveTabChange={handleActiveTabChange}
                            onToggleCollapse={() => {}}
                        />
                    </InspectorProvider>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
            <WorkspaceHeader
                embedded={false}
                taskId={taskId}
                workspace={workspace}
                isSubmittingRuleReview={isSubmittingRuleReview}
                onRuleReview={(outcome) => void handleRuleReviewWithState(outcome)}
                onNavigateDashboard={navigateBack}
            />
            <main className="grid flex-1 min-h-0 gap-3 p-3" style={workspaceLayoutStyle}>
                <WorkspaceContent {...sharedContentProps} />
                <div className="relative flex min-h-0 min-w-0 flex-col">
                    {resizeHandle}
                    <WorkspaceReviewPanel
                        workspace={workspace}
                        reviewerNote={reviewerNote}
                        reviewerId={reviewerId}
                        isSubmittingRuleReview={isSubmittingRuleReview}
                        onReviewerNoteChange={setReviewerNote}
                        onReviewerIdChange={setReviewerId}
                    />
                    <InspectorProvider value={inspectorProviderValue}>
                        <EventInspector
                            activeTab={activeTab}
                            className="min-h-[24rem]"
                            isCollapsed={false}
                            showCollapseControl={false}
                            onActiveTabChange={handleActiveTabChange}
                            onToggleCollapse={() => {}}
                        />
                    </InspectorProvider>
                </div>
            </main>
        </div>
    );
}
