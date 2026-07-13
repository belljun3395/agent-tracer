import { cn } from "~web/shared/ui/lib/cn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { JobFeedbackBar } from "~web/features/job-feedback/JobFeedbackBar.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import type { RuleGenerationController } from "~web/widgets/rules/generation/useRuleGeneration.js";

interface RuleGenerationRunStatusProps {
  readonly controller: RuleGenerationController;
}

/** 규칙 생성의 실행 차단 사유와 최신 잡 결과를 표시한다. */
export function RuleGenerationRunStatus({ controller }: RuleGenerationRunStatusProps) {
  const guidance = useGuidance();
  const {
    discardSummary,
    errorMessage,
    incompleteTimelineStatus,
    job,
    lastIntent,
    operationalBlockingReason,
  } = controller;

  return (
    <>
      {operationalBlockingReason && (
        <p className="mt-2 mb-0 text-[11px] text-ink-tertiary">
          {operationalBlockingReason}
        </p>
      )}
      {incompleteTimelineStatus && (
        <p className="mt-2 mb-0 text-[11px] text-warn">
          <span aria-hidden>⚠ </span>
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.rules.generation.incompleteTimeline(incompleteTimelineStatus)}
          />
        </p>
      )}
      {job && (
        <p
          className={cn(
            "mt-2 mb-0 text-[11px]",
            job.status === "failed" ? "text-err" : "text-ink-tertiary",
          )}
        >
          Last run: {job.status}
          {job.status === "completed" &&
            ` · ${job.rulesCreated} rules created (${job.modelUsed ?? "model unknown"}, ${
              job.durationMs != null ? `${Math.round(job.durationMs / 100) / 10}s` : "n/a"
            })`}
          {job.status === "completed" && discardSummary && (
            <span className="text-warn"> · discarded: {discardSummary}</span>
          )}
          {job.status === "failed" && job.error && ` · ${job.error}`}
        </p>
      )}
      {lastIntent !== undefined && (
        <p className="mt-1 mb-0 text-[11px] text-ink-subtle break-words">
          Intent: “{lastIntent}”
        </p>
      )}
      {job?.status === "completed" && (
        <JobFeedbackBar jobId={job.id} subject="rule" className="mt-2" />
      )}
      {errorMessage && <p className="mt-2 mb-0 text-[11px] text-err">{errorMessage}</p>}
    </>
  );
}
