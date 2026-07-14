import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { APP_SETTING_KEYS } from "@monitor/kernel";
import type { TaskId } from "~web/shared/identity.js";
import { JOB_KIND, isActiveJobStatus } from "~web/entities/job/model/job.js";
import type {
  GenerateRulesJobStatus,
  RuleGenerationJobInput,
} from "~web/entities/job/model/rule-generation.js";
import { useEnqueueJob } from "~web/entities/job/api/mutations.js";
import { useJobStatus } from "~web/entities/job/api/queries.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";
import { useAppSettingsQuery } from "~web/entities/setting/api/queries.js";
import { useTaskUserInputsQuery } from "~web/entities/task/api/detail-queries.js";
import {
  buildRuleGenerationInput,
  isUnhandledCompletedRuleJob,
  parseMaxRulesPerTask,
  readDiscardSummary,
  readRuleGenerationIntent,
} from "~web/widgets/rules/generation/rule-generation.js";

/** 규칙 생성 폼과 최신 잡 상태를 연결하는 화면 상태다. */
export function useRuleGeneration(taskId: TaskId, taskStatus: string | null) {
  const queryClient = useQueryClient();
  const settingsQuery = useAppSettingsQuery();
  const userInputsQuery = useTaskUserInputsQuery(taskId);
  const jobQuery = useJobStatus<GenerateRulesJobStatus>(JOB_KIND.ruleGeneration, { taskId });
  const enqueueMutation = useEnqueueJob<RuleGenerationJobInput>(JOB_KIND.ruleGeneration);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intentDraft, setIntentDraft] = useState("");
  const [anchorEventId, setAnchorEventId] = useState("");

  const userInputs = userInputsQuery.data ?? [];
  const latestInputId = userInputs.at(-1)?.eventId ?? "";
  useEffect(() => {
    if (latestInputId) setAnchorEventId(latestInputId);
  }, [latestInputId]);

  const maxRules = useMemo(() => {
    const setting = (settingsQuery.data?.settings ?? []).find(
      (item) => item.key === APP_SETTING_KEYS.ruleGenMaxRulesPerTask,
    );
    return parseMaxRulesPerTask(setting?.maskedValue);
  }, [settingsQuery.data]);

  const job = jobQuery.data?.job ?? null;
  const isInFlight = isActiveJobStatus(job?.status);
  const invalidatedJobRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isUnhandledCompletedRuleJob(job, invalidatedJobRef.current)) return;
    invalidatedJobRef.current = job?.id ?? null;
    void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.taskRules(taskId) });
    void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.rules() });
  }, [job?.id, job?.status, job?.rulesCreated, queryClient, taskId]);

  const generate = async () => {
    setErrorMessage(null);
    try {
      await enqueueMutation.mutateAsync(
        buildRuleGenerationInput(taskId, intentDraft, maxRules, anchorEventId),
      );
      setIntentDraft("");
      void jobQuery.refetch();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const settingsLoaded = !settingsQuery.isLoading;
  const disabled = !settingsLoaded || isInFlight || anchorEventId === "";
  const operationalBlockingReason = !settingsLoaded
    ? "Loading settings…"
    : isInFlight
      ? "Generation already in progress."
      : null;
  const incompleteTimelineStatus = !operationalBlockingReason && taskStatus !== "completed"
    ? taskStatus ?? "unknown"
    : null;

  return {
    anchorEventId,
    disabled,
    discardSummary: readDiscardSummary(job?.result),
    errorMessage,
    generate,
    incompleteTimelineStatus,
    intentDraft,
    isInFlight,
    job,
    lastIntent: readRuleGenerationIntent(job?.input),
    operationalBlockingReason,
    setAnchorEventId,
    setIntentDraft,
    userInputs,
  } as const;
}

export type RuleGenerationController = ReturnType<typeof useRuleGeneration>;
