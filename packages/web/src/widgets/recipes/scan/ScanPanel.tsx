import { useState } from "react";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, GuidanceText, Input } from "~web/shared/ui/index.js";
import type { RecipeScanJobInput } from "~web/entities/job/model/recipe-scan.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import {
  AgentBackendSelect,
  selectedAgentBackend,
  type AgentBackendChoice,
} from "~web/features/agent-backend-select/AgentBackendSelect.js";
import { TaskPicker } from "~web/widgets/recipes/scan/TaskPicker.js";

interface LatestJob {
  readonly status: string;
  readonly candidatesCreated: number;
  readonly sourceTaskId?: TaskId;
  readonly completedAt: string | null;
  readonly error: string | null;
}

interface ScanPanelProps {
  readonly isScanning: boolean;
  readonly latestJob: LatestJob | null;
  readonly tasks: readonly MonitoringTask[];
  readonly tasksLoading: boolean;
  readonly scannedTaskIds: ReadonlySet<string>;
  readonly includeArchivedTasks: boolean;
  readonly onIncludeArchivedTasksChange: (include: boolean) => void;
  readonly onScan: (input: RecipeScanJobInput) => void;
  readonly scanError: string | null;
}

/** 태스크 범위와 실행 백엔드를 선택해 레시피 스캔을 시작한다. */
export function ScanPanel({
  isScanning,
  latestJob,
  tasks,
  tasksLoading,
  scannedTaskIds,
  includeArchivedTasks,
  onIncludeArchivedTasksChange,
  onScan,
  scanError,
}: ScanPanelProps) {
  const guidance = useGuidance();
  // 앵커는 항상 사용자가 명시적으로 고른다.
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [agentBackend, setAgentBackend] = useState<AgentBackendChoice>("");

  const failureMessage =
    scanError ?? (latestJob?.status === "failed" ? latestJob.error : null);

  return (
    <div className="py-4 px-4 pb-3 border-b border-hair bg-canvas sm:px-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-semibold text-ink">Recipes</div>
          <GuidanceText
            as="div"
            className="text-xs text-ink-muted mt-1 max-w-[720px]"
            locale={guidance.locale}
            message={guidance.messages.recipes.introduction}
          />
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <span className="shrink-0 text-[11px] text-ink-muted uppercase tracking-[0.06em]">Task</span>
          <TaskPicker
            tasks={tasks}
            loading={tasksLoading}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
            scannedTaskIds={scannedTaskIds}
            includeArchived={includeArchivedTasks}
            onIncludeArchivedChange={onIncludeArchivedTasksChange}
            disabled={isScanning}
          />
        </div>
        <Input
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="What should the recipe capture?"
          className="w-full min-w-0 flex-1 sm:min-w-[260px]"
          disabled={isScanning}
        />
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <span className="shrink-0 text-[11px] text-ink-muted uppercase tracking-[0.06em]">Backend</span>
          <AgentBackendSelect
            value={agentBackend}
            onChange={setAgentBackend}
            disabled={isScanning}
            className="min-w-0 flex-1 sm:min-w-[154px]"
          />
        </div>
        <Button
          variant="primary"
          disabled={isScanning || selectedTaskId === null}
          onClick={() => {
            if (selectedTaskId === null) return;
            const selectedBackend = selectedAgentBackend(agentBackend);
            onScan({
              taskId: selectedTaskId,
              ...(userPrompt.trim() ? { userPrompt: userPrompt.trim() } : {}),
              ...(selectedBackend !== undefined ? { agentBackend: selectedBackend } : {}),
            });
          }}
          className={cn("w-full sm:w-auto", isScanning && "bg-s2 text-ink-subtle")}
        >
          {isScanning ? "Scanning…" : "Scan now"}
        </Button>
        {latestJob && (
          <span className="text-[11.5px] text-ink-muted">
            Last scan: {latestJob.status}
            {latestJob.status === "completed" && (
              <>
                {" "}
                · {latestJob.candidatesCreated} candidate
                {latestJob.candidatesCreated === 1 ? "" : "s"}
                {latestJob.sourceTaskId ? ` · ${latestJob.sourceTaskId.slice(0, 8)}` : ""}
              </>
            )}
          </span>
        )}
      </div>
      {failureMessage && (
        <div className="mt-2 text-xs py-1.5 px-2.5 rounded-sm bg-err/8 text-err">
          {failureMessage}
        </div>
      )}
    </div>
  );
}
