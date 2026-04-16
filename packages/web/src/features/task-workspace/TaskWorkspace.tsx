import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WorkspaceContent } from "./WorkspaceContent.js";
import { WorkspaceHeader } from "./WorkspaceHeader.js";
import { useWorkspace } from "./useWorkspace.js";
import { normalizeWorkspaceTab, REVIEWER_ID_STORAGE_KEY, WORKSPACE_INSPECTOR_DEFAULT_WIDTH, WORKSPACE_INSPECTOR_MAX_WIDTH, WORKSPACE_INSPECTOR_MIN_WIDTH, WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY } from "./constants.js";

export function TaskWorkspace({ taskId, embedded = false }: {
    readonly taskId: string;
    readonly embedded?: boolean;
}): React.JSX.Element {
    const workspace = useWorkspace(taskId);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [reviewerNote, setReviewerNote] = useState("");
    const [isSubmittingRuleReview, setIsSubmittingRuleReview] = useState(false);
    const [reviewerId, setReviewerId] = useState(() => {
        try { return window.localStorage.getItem(REVIEWER_ID_STORAGE_KEY) ?? "local-reviewer"; } catch { return "local-reviewer"; }
    });
    const [zoom, setZoom] = useState(1.1);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const [isWorkspaceControlsOpen, setIsWorkspaceControlsOpen] = useState(false);
    const [isWorkspaceFiltersOpen, setIsWorkspaceFiltersOpen] = useState(false);
    const [workspaceControlsPos, setWorkspaceControlsPos] = useState({ top: 0, right: 0 });
    const [workspaceFiltersPos, setWorkspaceFiltersPos] = useState({ top: 0, right: 0 });
    const workspaceControlsButtonRef = useRef<HTMLButtonElement>(null);
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
            if (window.location.pathname !== `/tasks/${encodeURIComponent(taskId)}`) return;
            void navigate(`/tasks/${encodeURIComponent(taskId)}?tab=${tab}`, { replace: true });
        },
        [navigate, taskId]
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

    const timelineEmbeddedProps = embedded ? {
        externalControlsState: { isOpen: isWorkspaceControlsOpen, setIsOpen: setIsWorkspaceControlsOpen, popoverPos: workspaceControlsPos, setPopoverPos: setWorkspaceControlsPos, buttonRef: workspaceControlsButtonRef },
        externalFiltersState: { isOpen: isWorkspaceFiltersOpen, setIsOpen: setIsWorkspaceFiltersOpen, popoverPos: workspaceFiltersPos, setPopoverPos: setWorkspaceFiltersPos, buttonRef: workspaceFiltersButtonRef },
    } : {};

    return (
        <div className={embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex h-dvh flex-col overflow-hidden bg-[var(--bg)]"}>
            <WorkspaceHeader
                embedded={embedded}
                taskId={taskId}
                workspace={workspace}
                isSubmittingRuleReview={isSubmittingRuleReview}
                onRuleReview={(outcome) => void handleRuleReviewWithState(outcome)}
                onNavigateBack={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}
                onNavigateDashboard={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}
                embeddedExtras={embedded ? {
                    isEditingTaskTitle: workspace.isEditingTaskTitle,
                    isWorkspaceControlsOpen,
                    isWorkspaceFiltersOpen,
                    workspaceControlsButtonRef,
                    workspaceFiltersButtonRef,
                    onWorkspaceControlsToggle: () => {
                        if (workspaceControlsButtonRef.current) {
                            const rect = workspaceControlsButtonRef.current.getBoundingClientRect();
                            setWorkspaceControlsPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                        }
                        setIsWorkspaceControlsOpen((v) => !v);
                    },
                    onWorkspaceFiltersToggle: () => {
                        if (workspaceFiltersButtonRef.current) {
                            const rect = workspaceFiltersButtonRef.current.getBoundingClientRect();
                            setWorkspaceFiltersPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                        }
                        setIsWorkspaceFiltersOpen((v) => !v);
                    },
                } : undefined}
            />
            <main className="flex flex-1 min-h-0 flex-col gap-3 p-3">
                <WorkspaceContent
                    taskId={taskId}
                    workspace={workspace}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    activeTab={activeTab}
                    onActiveTabChange={handleActiveTabChange}
                    isStackedWorkspace={isStackedWorkspace}
                    workspaceLayoutStyle={workspaceLayoutStyle}
                    onInspectorResizeStart={handleInspectorResizeStart}
                    embedded={embedded}
                    timelineEmbeddedProps={timelineEmbeddedProps}
                    reviewerNote={reviewerNote}
                    reviewerId={reviewerId}
                    isSubmittingRuleReview={isSubmittingRuleReview}
                    onReviewerNoteChange={setReviewerNote}
                    onReviewerIdChange={setReviewerId}
                    onNavigateBack={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}
                />
            </main>
        </div>
    );
}
