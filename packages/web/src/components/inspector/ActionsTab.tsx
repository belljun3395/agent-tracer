import type React from "react";
import { Badge } from "../ui/Badge.js";
import { PanelCard } from "../ui/PanelCard.js";
import { TaskEvaluatePanel } from "../TaskEvaluatePanel.js";
import { EvaluatePromptButton } from "../EvaluatePromptButton.js";
import { cardShell, cardHeader, cardBody } from "./styles.js";
import { summarizePath } from "./utils.js";
import type { TaskExtraction } from "@monitor/web-core";
import type { TimelineEvent } from "@monitor/web-core";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { TaskEvaluationPayload, TaskEvaluationRecord } from "@monitor/web-core";
function TaskExtractionCard({ extraction, workspacePath }: {
    readonly extraction: TaskExtraction;
    readonly workspacePath?: string | undefined;
}): React.JSX.Element {
    return (<PanelCard className={cardShell}>
      <div className={cardHeader}>
        <span>Task Extraction</span>
      </div>
      <div className={cardBody}>
        <div className="rounded-[14px] border border-[var(--exploration-border)] bg-[color-mix(in_srgb,var(--exploration-bg)_60%,var(--surface))] p-4">
          <strong className="block break-words text-[0.98rem] leading-6 text-[var(--text-1)] [overflow-wrap:anywhere]">{extraction.objective}</strong>
        </div>

        {extraction.sections.length > 0 && (<div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {extraction.sections.map((section) => (<div key={section.lane} className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                    {section.lane}
                  </Badge>
                  <strong className="min-w-0 text-[0.84rem] text-[var(--text-1)]">{section.title}</strong>
                </div>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => (<p key={`${section.lane}-${item}`} className="m-0 break-words text-[0.78rem] leading-6 text-[var(--text-2)] [overflow-wrap:anywhere]">
                      {item}
                    </p>))}
                </div>
              </div>))}
          </div>)}

        <div className="mt-3 flex flex-col gap-3">
          {extraction.validations.length > 0 && (<div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Validation</span>
              <div className="flex flex-wrap gap-2">
                {extraction.validations.map((item) => (<Badge key={item} tone="neutral" size="xs" className="max-w-full break-words">{item}</Badge>))}
              </div>
            </div>)}

          {extraction.files.length > 0 && (<div className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Files</span>
              <div className="flex flex-wrap gap-2">
                {extraction.files.slice(0, 6).map((filePath) => (<Badge key={filePath} tone="neutral" size="xs" className="max-w-full break-words" title={filePath}>
                    {summarizePath(filePath, workspacePath)}
                  </Badge>))}
                {extraction.files.length > 6 && (<Badge tone="neutral" size="xs">+{extraction.files.length - 6} more</Badge>)}
              </div>
            </div>)}
        </div>
      </div>
    </PanelCard>);
}
export interface ActionsTabProps {
    readonly taskId?: string | undefined;
    readonly taskTitle: string;
    readonly workspacePath?: string | undefined;
    readonly taskExtraction: TaskExtraction;
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
    readonly onSaveEvaluation: (data: TaskEvaluationPayload) => Promise<void>;
}
export function ActionsTab({ taskId, taskTitle, workspacePath, taskExtraction, taskTimeline, handoffPlans, handoffExploredFiles, handoffModifiedFiles, handoffOpenTodos, handoffOpenQuestions, handoffViolations, handoffSnapshot, evaluation, isSavingEvaluation, isSavedEvaluation, onSaveEvaluation }: ActionsTabProps): React.JSX.Element {
    return (<div className="panel-tab-inner flex flex-col gap-5 p-4">
      <TaskExtractionCard extraction={taskExtraction} workspacePath={workspacePath}/>
      {taskId && taskExtraction.objective && (
        <EvaluatePromptButton
          taskId={taskId}
          objective={taskExtraction.objective}
          summary={taskExtraction.summary}
          sections={taskExtraction.sections}
          plans={handoffPlans}
          exploredFiles={handoffExploredFiles}
          modifiedFiles={handoffModifiedFiles}
          openTodos={handoffOpenTodos}
          openQuestions={handoffOpenQuestions}
          violations={handoffViolations}
          snapshot={handoffSnapshot}
        />
      )}
      {taskId
            ? (<TaskEvaluatePanel taskId={taskId} taskTitle={taskTitle} taskTimeline={taskTimeline} evaluation={evaluation} isSaving={isSavingEvaluation} isSaved={isSavedEvaluation} onSave={onSaveEvaluation}/>)
            : (<div className="flex items-center justify-center py-8 text-[0.82rem] text-[var(--text-3)]">
            Select a task to evaluate it.
          </div>)}
    </div>);
}
