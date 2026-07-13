import type { JobDto } from "@monitor/kernel";
import { JOB_STATUS } from "~web/entities/job/model/job.js";
import { formatAbsoluteHHmmss, formatDuration } from "~web/shared/lib/formatting/time.js";
import { useJobQuery } from "~web/entities/job/api/queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import {
  EmptyHint,
  GuidanceText,
  Pill,
  ScrollArea,
  SectionLabel,
  StatusDot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~web/shared/ui/index.js";
import { JobFeedbackBar } from "~web/features/job-feedback/JobFeedbackBar.js";
import { JobResultActions } from "~web/widgets/jobs/result/JobResultActions.js";
import { feedbackSubject } from "~web/widgets/jobs/result/job-result.js";
import { JobTrajectory } from "~web/widgets/jobs/trajectory/JobTrajectory.js";
import {
  JOB_KIND_LABEL,
  JOB_STATUS_LABEL,
  elapsedMs,
  readUsage,
  statusDotKind,
} from "~web/widgets/jobs/lib/job-view.js";

interface JobDetailPanelProps {
  readonly jobId: string;
  readonly now: number;
}

export function JobDetailPanel({ jobId, now }: JobDetailPanelProps) {
  const guidance = useGuidance();
  const { data, isPending, isError } = useJobQuery(jobId);

  if (isPending) return <EmptyHint>Loading job…</EmptyHint>;
  if (isError) return <EmptyHint>Could not load the job.</EmptyHint>;

  const job = data.job;
  const elapsed = elapsedMs(job, now);
  const usage = readUsage(job);

  return (
    <Tabs defaultValue="overview" className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-2 border-b border-hair px-3 py-3">
        <div className="flex items-center gap-2">
          <StatusDot
            status={statusDotKind(job.status)}
            pulse={job.status === JOB_STATUS.running}
            tooltip={false}
          />
          <span className="text-[13.5px] font-medium text-ink">{JOB_KIND_LABEL[job.kind]}</span>
          <Pill tone={job.status === JOB_STATUS.failed ? "err" : "neutral"}>
            {JOB_STATUS_LABEL[job.status]}
          </Pill>
        </div>
        <div className="break-all font-mono text-[10.5px] text-ink-tertiary">{job.id}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
          <span>Executor {job.executor}</span>
          <span>{elapsed !== null ? `Duration ${formatDuration(elapsed)}` : "Not started"}</span>
          <span>{job.attempts} attempts</span>
          {usage.modelUsed ? <span>{usage.modelUsed}</span> : null}
          {usage.costUsd !== null ? <span>${usage.costUsd.toFixed(4)}</span> : null}
          {usage.numTurns !== null ? <span>{usage.numTurns} turns</span> : null}
        </div>
      </header>

      <TabsList className="shrink-0 px-3">
        <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
        <TabsTrigger value="trajectory" className="py-2.5">Trajectory</TabsTrigger>
        <TabsTrigger value="raw" className="py-2.5">Raw data</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-3">
            <JobMetadata job={job} />

            {job.error !== null ? (
              <section className="flex flex-col gap-1">
                <SectionLabel>Error</SectionLabel>
                <pre className="whitespace-pre-wrap break-words rounded-[var(--radius-xs)] border border-err/30 bg-[color-mix(in_srgb,var(--err)_5%,transparent)] p-2 text-[12px] text-err">
                  {job.error}
                </pre>
              </section>
            ) : null}

            <JobResultActions job={job} />

            {job.status === JOB_STATUS.completed ? (
              <JobFeedbackBar jobId={job.id} subject={feedbackSubject(job.kind)} />
            ) : null}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="trajectory" className="min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <section className="flex flex-col gap-2 p-3">
            <div>
              <SectionLabel>Trajectory</SectionLabel>
              <GuidanceText
                as="p"
                className="mt-1 text-[11.5px] text-ink-tertiary"
                locale={guidance.locale}
                message={guidance.messages.jobs.trajectoryIntroduction}
              />
            </div>
            <JobTrajectory jobId={job.id} status={job.status} />
          </section>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="raw" className="min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-3">
            <GuidanceText
              as="p"
              className="text-[11.5px] text-ink-tertiary"
              locale={guidance.locale}
              message={guidance.messages.jobs.rawDataIntroduction}
            />
            <JsonSection label="Input" value={job.input} />
            <JsonSection label="Result" value={job.result} />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function JobMetadata({ job }: { readonly job: JobDto }) {
  return (
    <section className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--radius-xs)] border border-hair bg-s1 p-2.5 text-[11.5px]">
      <Metadata label="Created" value={formatAbsoluteHHmmss(job.createdAt)} />
      <Metadata label="Completed" value={job.completedAt ? formatAbsoluteHHmmss(job.completedAt) : "—"} />
      <Metadata label="Target task" value={job.taskId ?? "None"} mono />
      <Metadata label="Updated" value={formatAbsoluteHHmmss(job.updatedAt)} />
    </section>
  );
}

function Metadata({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.06em] text-ink-tertiary">{label}</div>
      <div className={`mt-0.5 truncate text-ink-muted ${mono ? "font-mono text-[10.5px]" : ""}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function JsonSection({
  label,
  value,
}: {
  readonly label: string;
  readonly value: JobDto["input"];
}) {
  if (Object.keys(value).length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <pre className="overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-xs)] border border-hair bg-s1 p-2.5 text-[11.5px] leading-relaxed text-ink-subtle">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
