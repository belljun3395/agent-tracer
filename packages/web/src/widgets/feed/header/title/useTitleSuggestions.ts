import { useState } from "react";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { JOB_KIND, isActiveJobStatus } from "~web/entities/job/model/job.js";
import type {
  TitleSuggestion,
  TitleSuggestionJobInput,
  TitleSuggestionJobStatus,
} from "~web/entities/job/model/title-suggestion.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import {
  useEnqueueJob,
  useSubmitJobFeedbackMutation,
} from "~web/entities/job/api/mutations.js";
import { useJobStatus } from "~web/entities/job/api/queries.js";
import { useUpdateTaskMutation } from "~web/entities/task/api/edit-mutations.js";
import {
  selectedAgentBackend,
  type AgentBackendChoice,
} from "~web/features/agent-backend-select/AgentBackendSelect.js";

/** 제목 제안 잡의 요청과 결과 적용 및 피드백 생명주기를 소유한다. */
export function useTitleSuggestions(task: MonitoringTask) {
  const feedback = useSubmitJobFeedbackMutation();
  const update = useUpdateTaskMutation();
  const enqueue = useEnqueueJob<TitleSuggestionJobInput>(
    JOB_KIND.titleSuggestion,
  );
  const [open, setOpen] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const [agentBackend, setAgentBackend] = useState<AgentBackendChoice>("");
  const currentTitle = task.displayTitle ?? task.title;
  const jobStatus = useJobStatus<TitleSuggestionJobStatus>(
    JOB_KIND.titleSuggestion,
    { taskId: task.id, enabled: open },
  );
  const job = jobStatus.data?.job ?? null;
  const loading = enqueue.isPending || isActiveJobStatus(job?.status);
  const suggestions: readonly TitleSuggestion[] =
    job?.status === "completed" ? job.result?.suggestions ?? [] : [];
  const error =
    enqueueError ?? (job?.status === "failed" ? job.error : null);

  const show = () => {
    setEnqueueError(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEnqueueError(null);
  };

  const suggest = () => {
    const selectedBackend = selectedAgentBackend(agentBackend);
    setEnqueueError(null);
    setOpen(true);
    enqueue.mutate(
      {
        taskId: task.id,
        ...(selectedBackend !== undefined
          ? { agentBackend: selectedBackend }
          : {}),
      },
      {
        onError: (err: unknown) =>
          setEnqueueError(err instanceof Error ? err.message : String(err)),
      },
    );
  };

  const apply = (title: string) => {
    if (job?.status === "completed") {
      feedback.mutate({ jobId: job.id, kind: JOB_FEEDBACK_KIND.accept });
    }
    update.mutate(
      { taskId: task.id, body: { title } },
      { onSettled: close },
    );
  };

  return {
    open,
    loading,
    error,
    suggestions,
    jobId: job?.status === "completed" ? job.id : null,
    currentTitle,
    agentBackend,
    setAgentBackend,
    show,
    close,
    suggest,
    apply,
  } as const;
}
