import { useState } from "react";
import type { JobDto } from "@monitor/kernel";
import {
  JOB_STATUS,
  isCancelableJobStatus,
  type JobStatus,
} from "~web/entities/job/model/job.js";
import { formatAbsoluteHHmmss, formatDuration, formatRelativeShort } from "~web/shared/lib/formatting/time.js";
import { useCancelJobMutation } from "~web/entities/job/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, Modal, Pill } from "~web/shared/ui/index.js";
import {
  JOB_KIND_LABEL,
  JOB_STATUS_LABEL,
  elapsedMs,
  summarizeResult,
} from "~web/widgets/jobs/lib/job-view.js";

interface JobHistoryTableProps {
  readonly jobs: readonly JobDto[];
  readonly total: number;
  readonly now: number;
  readonly selectedJobId: string | null;
  readonly onSelect: (jobId: string) => void;
}

/** 잡 실행 이력과 행 단위 취소 진입점을 표로 표시한다. */
export function JobHistoryTable({
  jobs,
  total,
  now,
  selectedJobId,
  onSelect,
}: JobHistoryTableProps) {
  return (
    <table aria-label={`Job history, ${total} total`} className="w-full min-w-[760px] table-fixed border-collapse">
      <colgroup>
        <col className="w-[100px]" />
        <col className="w-[180px]" />
        <col />
        <col className="w-[96px]" />
        <col className="w-[82px]" />
        <col className="w-[82px]" />
        <col className="w-[64px]" />
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-s1">
        <tr className="border-b border-hair text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          <th className="px-3 py-2" scope="col">Status</th>
          <th className="px-3 py-2" scope="col">Job</th>
          <th className="px-3 py-2" scope="col">Result / error</th>
          <th className="px-3 py-2" scope="col">Executor</th>
          <th className="px-3 py-2" scope="col">Created</th>
          <th className="px-3 py-2 text-right" scope="col">Duration</th>
          <th className="px-3 py-2 text-right" scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            now={now}
            selected={job.id === selectedJobId}
            onSelect={() => onSelect(job.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

function JobRow({
  job,
  now,
  selected,
  onSelect,
}: {
  readonly job: JobDto;
  readonly now: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const elapsed = elapsedMs(job, now);
  const summary = summarizeResult(job);
  const outcome = job.error ?? summary ?? fallbackOutcome(job.status);

  return (
    <tr
      aria-selected={selected}
      className={`border-b border-hair transition-colors last:border-b-0 hover:bg-s2 ${
        selected ? "bg-[color-mix(in_srgb,var(--primary)_9%,var(--s1))]" : ""
      }`}
    >
      <td className="px-3 py-2.5">
        <Pill
          tone={statusTone(job.status)}
          dot
          pulse={job.status === JOB_STATUS.running}
          aria-label={`Status: ${JOB_STATUS_LABEL[job.status]}`}
        >
          {JOB_STATUS_LABEL[job.status]}
        </Pill>
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Open ${JOB_KIND_LABEL[job.kind]} job details`}
          className="group block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus"
        >
          <span className="block truncate text-[12.5px] font-medium text-ink group-hover:text-primary-hover">
            {JOB_KIND_LABEL[job.kind]}
          </span>
          <span className="block truncate font-mono text-[10.5px] text-ink-tertiary" title={job.id}>
            {shortId(job.id)}{job.taskId ? ` · ${shortId(job.taskId)}` : " · No target"}
          </span>
        </button>
      </td>
      <td className={`truncate px-3 py-2.5 text-[12px] ${job.error ? "text-err" : "text-ink-muted"}`} title={outcome}>
        {outcome}
      </td>
      <td className="px-3 py-2.5">
        <Pill tone="neutral">{job.executor}</Pill>
      </td>
      <td className="px-3 py-2.5">
        <time
          dateTime={job.createdAt}
          title={formatAbsoluteHHmmss(job.createdAt)}
          className="text-[11.5px] tabular-nums text-ink-muted"
        >
          {formatRelativeShort(job.createdAt, now)}
        </time>
      </td>
      <td className="px-3 py-2.5 text-right text-[11.5px] tabular-nums text-ink-muted">
        {elapsed !== null ? formatDuration(elapsed) : "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        <CancelButton job={job} />
      </td>
    </tr>
  );
}

function CancelButton({ job }: { readonly job: JobDto }) {
  const guidance = useGuidance();
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelJobMutation();

  if (!isCancelableJobStatus(job.status)) return <span aria-hidden className="text-ink-tertiary">—</span>;

  return (
    <>
      <Button
        className="px-2 py-1 text-[11.5px]"
        onClick={() => setConfirming(true)}
        disabled={cancel.isPending}
      >
        Cancel
      </Button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cancel this job?"
        description={guidance.messages.jobs.cancel}
        descriptionLocale={guidance.locale}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirming(false)}>Close</Button>
          <Button
            variant="primary"
            onClick={() => {
              cancel.mutate(job.id, { onSettled: () => setConfirming(false) });
            }}
            disabled={cancel.isPending}
          >
            Cancel job
          </Button>
        </div>
      </Modal>
    </>
  );
}

function fallbackOutcome(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.pending:
      return "Waiting to run";
    case JOB_STATUS.running:
      return "Running";
    case JOB_STATUS.completed:
      return "No result";
    case JOB_STATUS.failed:
      return "No error details";
    case JOB_STATUS.canceled:
      return "Canceled by user";
  }
}

function statusTone(status: JobStatus): "neutral" | "ok" | "warn" | "err" | "primary" {
  switch (status) {
    case JOB_STATUS.pending:
      return "warn";
    case JOB_STATUS.running:
      return "primary";
    case JOB_STATUS.completed:
      return "ok";
    case JOB_STATUS.failed:
      return "err";
    case JOB_STATUS.canceled:
      return "neutral";
  }
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `…${value.slice(-8)}`;
}
