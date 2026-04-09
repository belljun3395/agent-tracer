/**
 * Actions 탭 — 태스크 추출, compact 활동, 핸드오프, 평가 패널 뷰.
 */

import type React from "react";
import { cn } from "../../lib/ui/cn.js";
import { formatRelativeTime } from "../../lib/timeline.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { PanelCard } from "../ui/PanelCard.js";
import { TaskHandoffPanel } from "../TaskHandoffPanel.js";
import { TaskEvaluatePanel } from "../TaskEvaluatePanel.js";
import { cardShell, cardHeader, cardBody, innerPanel } from "./styles.js";
import { summarizePath, summarizeDetailText } from "./utils.js";
import type {
  CompactInsight,
  TaskExtraction
} from "../../lib/insights.js";
import type { TimelineEvent } from "../../types.js";
import type { ModelSummary } from "../../lib/insights.js";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "../../api.js";

// ---------------------------------------------------------------------------
// TaskExtractionCard
// ---------------------------------------------------------------------------

function TaskExtractionCard({
  extraction, workspacePath
}: {
  readonly extraction: TaskExtraction;
  readonly workspacePath?: string | undefined;
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Task Extraction</span>
      </div>
      <div className={cardBody}>
        <div className="rounded-[14px] border border-[var(--exploration-border)] bg-[color-mix(in_srgb,var(--exploration-bg)_60%,var(--surface))] p-4">
          <strong className="block break-words text-[0.98rem] leading-6 text-[var(--text-1)] [overflow-wrap:anywhere]">{extraction.objective}</strong>
        </div>

        {extraction.sections.length > 0 && (
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {extraction.sections.map((section) => (
              <div key={section.lane} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                    {section.lane}
                  </Badge>
                  <strong className="min-w-0 text-[0.84rem] text-[var(--text-1)]">{section.title}</strong>
                </div>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => (
                    <p key={`${section.lane}-${item}`} className="m-0 break-words text-[0.78rem] leading-6 text-[var(--text-2)] [overflow-wrap:anywhere]">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {extraction.validations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Validation</span>
              <div className="flex flex-wrap gap-2">
                {extraction.validations.map((item) => (
                  <Badge key={item} tone="neutral" size="xs" className="max-w-full break-words">{item}</Badge>
                ))}
              </div>
            </div>
          )}

          {extraction.files.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Files</span>
              <div className="flex flex-wrap gap-2">
                {extraction.files.slice(0, 6).map((filePath) => (
                  <Badge key={filePath} tone="neutral" size="xs" className="max-w-full break-words" title={filePath}>
                    {summarizePath(filePath, workspacePath)}
                  </Badge>
                ))}
                {extraction.files.length > 6 && (
                  <Badge tone="neutral" size="xs">+{extraction.files.length - 6} more</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// CompactActivityCard
// ---------------------------------------------------------------------------

function CompactActivityCard({
  insight, selectedTag, onSelectTag
}: {
  readonly insight: CompactInsight;
  readonly selectedTag: string | null;
  readonly onSelectTag: (tag: string) => void;
}): React.JSX.Element {
  return (
    <PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Compact Activity</span>
        <Button
          className={cn(
            "h-auto rounded-full px-3 py-1.5 text-[0.72rem] font-semibold shadow-none",
            selectedTag === "compact"
              ? "border-[var(--planning)] bg-[color-mix(in_srgb,var(--planning)_12%,var(--surface))] text-[var(--planning)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
          )}
          disabled={insight.occurrences === 0 && insight.handoffCount === 0}
          onClick={() => onSelectTag("compact")}
          size="sm"
          type="button"
          variant="bare"
        >
          Focus compact
        </Button>
      </div>
      <div className={cardBody}>
        {insight.occurrences === 0 && insight.handoffCount === 0 ? (
          <p className="m-0 text-[0.8rem] text-[var(--text-3)]">
            No compact-related task activity has been recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Compacts</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.occurrences}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Handoffs</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.handoffCount}</strong>
              </div>
              <div className={innerPanel + " p-3"}>
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Markers</span>
                <strong className="mt-2 block text-[1.05rem] text-[var(--text-1)]">{insight.eventCount}</strong>
              </div>
            </div>
            {(insight.beforeCount > 0 || insight.afterCount > 0) && (
              <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                <div className={innerPanel + " p-3"}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Before compact</span>
                  <strong className="mt-2 block text-[1.05rem] text-[color-mix(in_srgb,#f59e0b_80%,var(--text-1))]">{insight.beforeCount}</strong>
                </div>
                <div className={innerPanel + " p-3"}>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">After compact</span>
                  <strong className="mt-2 block text-[1.05rem] text-[color-mix(in_srgb,#10b981_80%,var(--text-1))]">{insight.afterCount}</strong>
                </div>
              </div>
            )}
            {insight.tagFacets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {insight.tagFacets.map((tag) => (
                  <Button
                    key={tag}
                    className={cn(
                      "h-auto rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold shadow-none",
                      selectedTag === tag
                        ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                    )}
                    onClick={() => onSelectTag(tag)}
                    size="sm"
                    type="button"
                    variant="bare"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            )}
            {(insight.latestTitle || insight.latestBody || insight.lastSeenAt) && (
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <strong className="min-w-0 text-[0.92rem] text-[var(--text-1)]">{insight.latestTitle ?? "Latest compact signal"}</strong>
                  {insight.lastSeenAt && (
                    <Badge tone="accent" size="xs">{formatRelativeTime(insight.lastSeenAt)}</Badge>
                  )}
                </div>
                {insight.latestBody && (
                  <p className="mt-2 text-[0.82rem] leading-6 text-[var(--text-2)]">{summarizeDetailText(insight.latestBody, 220)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// ActionsTab
// ---------------------------------------------------------------------------

export interface ActionsTabProps {
  readonly taskId?: string;
  readonly taskTitle: string;
  readonly workspacePath?: string;
  readonly taskExtraction: TaskExtraction;
  readonly compactInsight: CompactInsight;
  readonly selectedTag: string | null;
  readonly taskTimeline: readonly TimelineEvent[];
  readonly handoffPlans: readonly string[];
  readonly handoffExploredFiles: readonly string[];
  readonly handoffModifiedFiles: readonly string[];
  readonly handoffOpenTodos: readonly string[];
  readonly handoffOpenQuestions: readonly string[];
  readonly handoffViolations: readonly string[];
  readonly handoffSnapshot: ReusableTaskSnapshot;
  readonly evaluation: TaskEvaluationRecord | null;
  readonly isSavingEvaluation: boolean;
  readonly isSavedEvaluation: boolean;
  readonly onSelectTag: (tag: string | null) => void;
  readonly onSaveEvaluation: (data: TaskEvaluationPayload) => Promise<void>;
}

export function ActionsTab({
  taskId,
  taskTitle,
  workspacePath,
  taskExtraction,
  compactInsight,
  selectedTag,
  taskTimeline,
  handoffPlans,
  handoffExploredFiles,
  handoffModifiedFiles,
  handoffOpenTodos,
  handoffOpenQuestions,
  handoffViolations,
  handoffSnapshot,
  evaluation,
  isSavingEvaluation,
  isSavedEvaluation,
  onSelectTag,
  onSaveEvaluation
}: ActionsTabProps): React.JSX.Element {
  return (
    <div className="panel-tab-inner flex flex-col gap-5 p-4">
      <TaskExtractionCard
        extraction={taskExtraction}
        workspacePath={workspacePath}
      />
      <CompactActivityCard
        insight={compactInsight}
        selectedTag={selectedTag}
        onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)}
      />
      {taskExtraction.objective && (
        <TaskHandoffPanel
          {...(taskId ? { taskId } : {})}
          objective={taskExtraction.objective}
          summary={taskExtraction.summary}
          plans={handoffPlans}
          sections={taskExtraction.sections}
          exploredFiles={handoffExploredFiles}
          modifiedFiles={handoffModifiedFiles}
          openTodos={handoffOpenTodos}
          openQuestions={handoffOpenQuestions}
          violations={handoffViolations}
          snapshot={handoffSnapshot}
        />
      )}
      {taskId
        ? (
          <TaskEvaluatePanel
            taskId={taskId}
            taskTitle={taskTitle}
            taskTimeline={taskTimeline}
            evaluation={evaluation}
            isSaving={isSavingEvaluation}
            isSaved={isSavedEvaluation}
            onSave={onSaveEvaluation}
          />
        )
        : (
          <div className="flex items-center justify-center py-8 text-[0.82rem] text-[var(--text-3)]">
            Select a task to evaluate it.
          </div>
        )
      }
    </div>
  );
}
