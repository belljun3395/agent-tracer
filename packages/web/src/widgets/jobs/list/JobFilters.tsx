import type { ReactNode } from "react";
import type { JobKind, JobStatus } from "~web/entities/job/model/job.js";
import { JOB_KIND, JOB_STATUSES } from "~web/entities/job/model/job.js";
import { Button } from "~web/shared/ui/index.js";
import { JOB_KIND_LABEL, JOB_STATUS_LABEL } from "~web/widgets/jobs/lib/job-view.js";

const KIND_FILTERS: readonly JobKind[] = Object.values(JOB_KIND);

interface JobFiltersProps {
  readonly kind: JobKind | undefined;
  readonly status: JobStatus | undefined;
  readonly onChange: (updates: Record<string, string | null>) => void;
  readonly onReset: () => void;
}

/** 잡 종류와 실행 상태 URL 필터를 한 제어군으로 표시한다. */
export function JobFilters({ kind, status, onChange, onReset }: JobFiltersProps) {
  const hasFilters = kind !== undefined || status !== undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <FilterGroup label="Job kind">
        <FilterChip
          label="All"
          active={kind === undefined}
          onClick={() => onChange({ kind: null })}
        />
        {KIND_FILTERS.map((value) => (
          <FilterChip
            key={value}
            label={JOB_KIND_LABEL[value]}
            active={kind === value}
            onClick={() => onChange({ kind: value })}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Status">
        <FilterChip
          label="All statuses"
          active={status === undefined}
          onClick={() => onChange({ status: null })}
        />
        {JOB_STATUSES.map((value) => (
          <FilterChip
            key={value}
            label={JOB_STATUS_LABEL[value]}
            active={status === value}
            onClick={() => onChange({ status: value })}
          />
        ))}
      </FilterGroup>

      {hasFilters ? (
        <Button className="ml-auto px-2.5 py-1 text-[11.5px]" onClick={onReset}>
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-[var(--radius-xs)] border px-2 py-0.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus ${
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-hair bg-transparent text-ink-muted hover:border-hair-strong hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
