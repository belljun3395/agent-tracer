import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { GuidanceMessage } from "~web/shared/guidance.js";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import { useJobsHistoryQuery } from "~web/entities/job/api/queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, Card, EmptyHint, GuidanceText } from "~web/shared/ui/index.js";
import { JobDetailPanel } from "~web/widgets/jobs/detail/JobDetailPanel.js";
import { isJobKind, isJobStatus } from "~web/widgets/jobs/lib/job-view.js";
import { JobFilters } from "~web/widgets/jobs/list/JobFilters.js";
import { JobHistoryTable } from "~web/widgets/jobs/list/JobHistoryTable.js";

const ELAPSED_TICK_MS = 1_000;
const PAGE_SIZE = 25;

export function JobsPage() {
  const guidance = useGuidance();
  const [params, setParams] = useSearchParams();
  const kindParam = params.get("kind");
  const statusParam = params.get("status");
  const kind = isJobKind(kindParam) ? kindParam : undefined;
  const status = isJobStatus(statusParam) ? statusParam : undefined;
  const selectedJobId = params.get("job");
  const page = readPage(params.get("page"));
  const offset = (page - 1) * PAGE_SIZE;
  const now = useNowMs(ELAPSED_TICK_MS);

  const { data, isPending, isError, isFetching, refetch } = useJobsHistoryQuery({
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    limit: PAGE_SIZE,
    offset,
  });

  useEffect(() => {
    if (selectedJobId === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("job");
        return next;
      }, { replace: true });
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedJobId, setParams]);

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function updateFilter(updates: Record<string, string | null>) {
    updateParams({ ...updates, page: null, job: null });
  }

  function resetFilters() {
    updateParams({ kind: null, status: null, page: null, job: null });
  }

  const hasFilters = kind !== undefined || status !== undefined;
  const rangeStart = data && data.total > 0 ? offset + 1 : 0;
  const rangeEnd = data ? offset + data.items.length : 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = data !== undefined && rangeEnd < data.total;

  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-[15px] font-medium text-ink">Agent jobs</h1>
              <GuidanceText
                as="p"
                className="mt-0.5 text-[11.5px] text-ink-tertiary"
                locale={guidance.locale}
                message={guidance.messages.jobs.introduction}
              />
            </div>
            {data ? (
              <span className="text-[12px] tabular-nums text-ink-muted">
                <strong className="font-medium text-ink">{data.total}</strong> total
                {isFetching ? " · Refreshing" : ""}
              </span>
            ) : null}
          </div>

          <JobFilters kind={kind} status={status} onChange={updateFilter} onReset={resetFilters} />
        </header>

        <Card className="min-h-0 flex-1 overflow-auto p-0">
          {isPending ? (
            <EmptyHint>Loading job history…</EmptyHint>
          ) : isError ? (
            <StateMessage
              title="Could not load job history."
              actionLabel="Try again"
              onAction={() => void refetch()}
            />
          ) : data.items.length === 0 ? (
            <StateMessage
              title={hasFilters ? "No jobs match the selected filters." : "No jobs have run yet."}
              {...(hasFilters
                ? {
                    description: guidance.messages.jobs.resetFilters,
                    actionLabel: "View all jobs",
                    onAction: resetFilters,
                  }
                : {})}
            />
          ) : (
            <JobHistoryTable
              jobs={data.items}
              total={data.total}
              now={now}
              selectedJobId={selectedJobId}
              onSelect={(jobId) => updateParams({ job: jobId })}
            />
          )}
        </Card>

        {data && data.total > 0 ? (
          <footer className="flex items-center justify-between gap-3 text-[11.5px] text-ink-muted">
            <span className="tabular-nums">{rangeStart}–{rangeEnd} / {data.total}</span>
            <div className="flex gap-1.5">
              <Button
                aria-label="Previous page"
                className="px-2.5 py-1"
                disabled={!hasPreviousPage}
                onClick={() => updateParams({ page: page === 2 ? null : String(page - 1), job: null })}
              >
                Previous
              </Button>
              <Button
                aria-label="Next page"
                className="px-2.5 py-1"
                disabled={!hasNextPage}
                onClick={() => updateParams({ page: String(page + 1), job: null })}
              >
                Next
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      {selectedJobId !== null ? (
        <aside
          role="dialog"
          aria-labelledby="job-detail-title"
          className="fixed inset-y-14 right-2 z-30 flex w-[min(520px,calc(100vw-1rem))] min-w-0 flex-col rounded-md bg-canvas p-2 shadow-2xl 2xl:static 2xl:z-auto 2xl:w-[480px] 2xl:shrink-0 2xl:rounded-none 2xl:bg-transparent 2xl:p-0 2xl:shadow-none"
        >
          <div className="flex items-center justify-between px-1 pb-1.5">
            <h2 id="job-detail-title" className="text-[12.5px] font-medium text-ink">Job details</h2>
            <Button autoFocus onClick={() => updateParams({ job: null })}>Close</Button>
          </div>
          <Card className="min-h-0 flex-1 overflow-hidden p-0">
            <JobDetailPanel jobId={selectedJobId} now={now} />
          </Card>
        </aside>
      ) : null}
    </div>
  );
}

function StateMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly description?: GuidanceMessage;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <EmptyHint>
      <div className="flex flex-col items-center gap-2">
        <p className="text-[13px] text-ink-muted">{title}</p>
        {description ? (
          <StateDescription description={description} />
        ) : null}
        {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
      </div>
    </EmptyHint>
  );
}

function StateDescription({ description }: { readonly description: GuidanceMessage }) {
  const guidance = useGuidance();
  return (
    <GuidanceText
      as="p"
      className="text-[11.5px] text-ink-tertiary"
      locale={guidance.locale}
      message={description}
    />
  );
}

function readPage(value: string | null): number {
  if (value === null) return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}
