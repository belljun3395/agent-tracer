/**
 * 인스펙터 컨테이너.
 * QuickInspector + 인스펙터 리사이즈 핸들러를 감싸는 focused 컴포넌트.
 * 북마크·이벤트 타이틀 업데이트·태그·룰 선택·선택 이벤트·커넥터 파생을 직접 처리한다.
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useMonitorStore } from "../store/useMonitorStore.js";
import { cn } from "../lib/ui/cn.js";
import { QuickInspector } from "./QuickInspector.js";
import { fetchTaskObservability, updateEventDisplayTitle } from "../api.js";
import {
  buildInspectorEventTitle,
  buildModelSummary,
  filterTimelineEvents
} from "../lib/insights.js";
import { buildTimelineRelations } from "../lib/timeline.js";
import type { TaskObservabilityResponse } from "../types.js";

// ---------------------------------------------------------------------------
// Connector key parser (internal helper)
// ---------------------------------------------------------------------------

function parseConnectorKey(
  key: string
): { sourceEventId: string; targetEventId: string; relationType?: string } | null {
  const [sourceEventId, targetPart] = key.split("→");
  if (!sourceEventId || !targetPart) return null;
  const [targetEventId, relationType] = targetPart.split(":");
  if (!targetEventId) return null;
  return { sourceEventId, targetEventId, ...(relationType ? { relationType } : {}) };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InspectorContainerProps {
  readonly isStackedDashboard: boolean;
  readonly isInspectorCollapsed: boolean;
  readonly selectedTaskDisplayTitle: string | null;
  readonly onToggleCollapse: () => void;
  /** @deprecated 드로어 모드에서는 사용하지 않음 */
  readonly onInspectorResizeStart?: ((event: React.PointerEvent<HTMLDivElement>) => void) | undefined;
  readonly onOpenTaskWorkspace?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InspectorContainer({
  isStackedDashboard,
  isInspectorCollapsed,
  selectedTaskDisplayTitle,
  onToggleCollapse,
  onOpenTaskWorkspace
}: InspectorContainerProps): React.JSX.Element {
  const {
    state,
    dispatch,
    refreshTaskDetail,
    handleCreateTaskBookmark,
    handleCreateEventBookmark
  } = useMonitorStore();

  const {
    bookmarks,
    selectedTaskId,
    selectedEventId,
    selectedConnectorKey,
    selectedTag,
    selectedRuleId,
    showRuleGapsOnly,
    taskDetail
  } = state;

  const [taskObservability, setTaskObservability] = useState<TaskObservabilityResponse | null>(null);

  const refreshTaskObservability = useCallback(async (taskId: string): Promise<void> => {
    try {
      const next = await fetchTaskObservability(taskId);
      setTaskObservability(next);
    } catch {
      setTaskObservability(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskObservability(null);
      return;
    }
    void refreshTaskObservability(selectedTaskId);
  }, [refreshTaskObservability, selectedTaskId]);

  const taskTimeline = taskDetail?.timeline ?? [];
  const modelSummary = useMemo(() => buildModelSummary(taskTimeline), [taskTimeline]);

  // Derive filtered timeline for event selection
  const filteredTimeline = useMemo(
    () => filterTimelineEvents(taskTimeline, {
      laneFilters: { user: true, questions: true, todos: true, background: true, coordination: true, exploration: true, planning: true, implementation: true },
      selectedRuleId,
      selectedTag,
      showRuleGapsOnly
    }),
    [selectedRuleId, selectedTag, showRuleGapsOnly, taskTimeline]
  );

  // Derive selected connector
  const selectedConnector = useMemo(() => {
    if (!selectedConnectorKey) return null;
    const parsed = parseConnectorKey(selectedConnectorKey);
    if (!parsed) return null;
    const source = taskTimeline.find((e) => e.id === parsed.sourceEventId);
    const target = taskTimeline.find((e) => e.id === parsed.targetEventId);
    if (!source || !target) return null;
    const relation = buildTimelineRelations(taskTimeline).find((item) =>
      item.sourceEventId === source.id
      && item.targetEventId === target.id
      && (item.relationType ?? undefined) === parsed.relationType
    );
    return {
      connector: {
        key: selectedConnectorKey,
        path: "",
        lane: target.lane,
        cross: source.lane !== target.lane,
        sourceEventId: source.id,
        targetEventId: target.id,
        sourceLane: source.lane,
        targetLane: target.lane,
        isExplicit: relation?.isExplicit ?? parsed.relationType !== "sequence",
        ...((relation?.relationType ?? parsed.relationType) !== undefined
          ? { relationType: relation?.relationType ?? parsed.relationType }
          : {}),
        ...(relation?.label !== undefined ? { label: relation.label } : {}),
        ...(relation?.explanation !== undefined ? { explanation: relation.explanation } : {}),
        ...(relation?.workItemId !== undefined ? { workItemId: relation.workItemId } : {}),
        ...(relation?.goalId !== undefined ? { goalId: relation.goalId } : {}),
        ...(relation?.planId !== undefined ? { planId: relation.planId } : {}),
        ...(relation?.handoffId !== undefined ? { handoffId: relation.handoffId } : {})
      },
      source,
      target
    };
  }, [selectedConnectorKey, taskTimeline]);

  const selectedEvent = selectedConnector
    ? null
    : filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[0] ?? null;

  const selectedEventDisplayTitle = selectedEvent
    ? buildInspectorEventTitle(selectedEvent, { taskDisplayTitle: selectedTaskDisplayTitle })
    : null;

  const selectedTaskBookmark = selectedTaskId
    ? bookmarks.find((b) => b.taskId === selectedTaskId && !b.eventId) ?? null
    : null;

  const selectedEventBookmark = selectedEvent
    ? bookmarks.find((b) => b.eventId === selectedEvent.id) ?? null
    : null;

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-col", isStackedDashboard && "order-3")}>
      <QuickInspector
        taskDetail={taskDetail}
        selectedTaskTitle={selectedTaskDisplayTitle}
        taskObservability={taskObservability}
        taskModelSummary={modelSummary}
        selectedEvent={selectedEvent}
        selectedConnector={selectedConnector}
        selectedEventDisplayTitle={selectedEventDisplayTitle}
        selectedTaskBookmark={selectedTaskBookmark}
        selectedEventBookmark={selectedEventBookmark}
        selectedTag={selectedTag}
        selectedRuleId={selectedRuleId}
        isCollapsed={isInspectorCollapsed}
        {...(onOpenTaskWorkspace !== undefined ? { onOpenTaskWorkspace } : {})}
        onToggleCollapse={onToggleCollapse}
        onCreateTaskBookmark={() => {
          void handleCreateTaskBookmark().catch((err) => {
            dispatch({
              type: "SET_STATUS",
              status: "error",
              errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
            });
          });
        }}
        onCreateEventBookmark={() => {
          if (!selectedEvent) return;
          void handleCreateEventBookmark(
            selectedEvent.id,
            selectedEventDisplayTitle ?? selectedEvent.title
          ).catch((err) => {
            dispatch({
              type: "SET_STATUS",
              status: "error",
              errorMessage: err instanceof Error ? err.message : "Failed to save event bookmark."
            });
          });
        }}
        onUpdateEventDisplayTitle={async (eventId, displayTitle) => {
          if (!selectedTaskId) return;
          await updateEventDisplayTitle(eventId, displayTitle);
          await refreshTaskDetail(selectedTaskId);
        }}
        onSelectTag={(tag) => dispatch({ type: "SELECT_TAG", tag })}
        onSelectRule={(ruleId) => {
          dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
          dispatch({ type: "SELECT_RULE", ruleId });
        }}
      />
    </div>
  );
}
