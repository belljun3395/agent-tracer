import type { AiJobRecordedStep } from "@monitor/kernel";
import { isActiveJobStatus, type JobStatus } from "~web/entities/job/model/job.js";
import type { GuidanceMessage } from "~web/shared/guidance.js";
import { useJobStepsQuery } from "~web/entities/job/api/queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Badge, EmptyHint, GuidanceText, Pill } from "~web/shared/ui/index.js";
import { formatDuration } from "~web/shared/lib/formatting/time.js";

interface JobTrajectoryProps {
  readonly jobId: string;
  readonly status: JobStatus;
}

// 궤적은 잡 완료 시점에 일괄 저장된다.
/** 실행 중인 잡의 모델·도구 호출 궤적을 표시한다. */
export function JobTrajectory({ jobId, status }: JobTrajectoryProps) {
  const guidance = useGuidance();
  const active = isActiveJobStatus(status);
  const { data, isPending, isError } = useJobStepsQuery(active ? null : jobId);

  if (active) {
    return <TrajectoryHint message={guidance.messages.jobs.trajectoryAfterCompletion} />;
  }
  if (isPending) {
    return <TrajectoryHint message={guidance.messages.jobs.loadingTrajectory} />;
  }
  if (isError) {
    return <TrajectoryHint message={guidance.messages.jobs.trajectoryUnavailable} />;
  }
  if (data.length === 0) {
    return <TrajectoryHint message={guidance.messages.jobs.noTrajectory} />;
  }

  return (
    <ol className="flex flex-col gap-2">
      {data.map((step) => (
        <StepRow key={`${step.attempt}-${step.seq}`} step={step} />
      ))}
    </ol>
  );
}

function TrajectoryHint({ message }: { readonly message: GuidanceMessage }) {
  const guidance = useGuidance();
  return (
    <EmptyHint>
      <GuidanceText locale={guidance.locale} message={message} />
    </EmptyHint>
  );
}

function StepRow({ step }: { readonly step: AiJobRecordedStep }) {
  const guidance = useGuidance();
  const tokens = totalTokens(step);
  return (
    <li className="rounded-[var(--radius-xs)] border border-hair p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{step.role}</Badge>
        <Pill tone="neutral">
          <GuidanceText locale={guidance.locale} message={guidance.messages.jobs.trajectoryAttempt} /> {step.attempt}
        </Pill>
        <span className="text-[11.5px] text-ink-muted">#{step.seq}</span>
        {step.toolName ? <Pill tone="primary">{step.toolName}</Pill> : null}
        {step.toolCalls.map((call) => (
          <Pill key={call.id} tone="primary">
            {call.name}
          </Pill>
        ))}
        {step.stopReason ? <Pill tone="neutral">{step.stopReason}</Pill> : null}
        {step.nodeName ? <Pill tone="primary">{step.nodeName}</Pill> : null}
        {step.eventKind ? <Pill tone="neutral">{step.eventKind}</Pill> : null}
        {step.truncated ? <Pill tone="warn">Truncated</Pill> : null}
        {step.durationMs !== undefined ? (
          <span className="text-[11.5px] text-ink-muted">{formatDuration(step.durationMs)}</span>
        ) : null}
        {tokens !== null ? (
          <span className="ml-auto text-[11.5px] text-ink-muted">{tokens} tokens</span>
        ) : null}
      </div>
      {step.content.length > 0 ? (
        <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[12px] text-ink-subtle">
          {step.content}
        </pre>
      ) : null}
    </li>
  );
}

function totalTokens(step: AiJobRecordedStep): number | null {
  const sum = (step.inputTokens ?? 0) + (step.outputTokens ?? 0);
  return sum > 0 ? sum : null;
}
