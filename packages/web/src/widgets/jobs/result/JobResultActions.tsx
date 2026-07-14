import { Link } from "react-router-dom";
import type { JobDto } from "@monitor/kernel";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import { TaskId } from "~web/shared/identity.js";
import type { CleanupSuggestion } from "~web/entities/task-cleanup/model/task-cleanup.js";
import {
  useAcceptCleanupSuggestionMutation,
  useDismissCleanupSuggestionMutation,
} from "~web/entities/task-cleanup/api/mutations.js";
import { useUpdateTaskMutation } from "~web/entities/task/api/edit-mutations.js";
import { useTaskCleanupSuggestionsQuery } from "~web/entities/task-cleanup/api/queries.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, EmptyHint, GuidanceText, SectionLabel } from "~web/shared/ui/index.js";
import { summarizeResult } from "~web/widgets/jobs/lib/job-view.js";
import { readTitleSuggestions } from "~web/widgets/jobs/result/job-result.js";

interface JobResultActionsProps {
  readonly job: JobDto;
}

// 잡 결과를 실제 변경으로 옮기는 지점.
export function JobResultActions({ job }: JobResultActionsProps) {
  if (job.status !== JOB_STATUS.completed) return null;

  switch (job.kind) {
    case JOB_KIND.titleSuggestion:
      return <TitleSuggestionActions job={job} />;
    case JOB_KIND.taskCleanup:
      return <TaskCleanupActions job={job} />;
    case JOB_KIND.recipeScan:
      return (
        <ResultLink
          summary={summarizeResult(job)}
          to="/recipes"
          label="Review candidates in Recipes"
        />
      );
    case JOB_KIND.ruleGeneration:
      return (
        <ResultLink summary={summarizeResult(job)} to="/rules" label="View in Rules" />
      );
  }
}

function TitleSuggestionActions({ job }: JobResultActionsProps) {
  const guidance = useGuidance();
  const updateTask = useUpdateTaskMutation();
  const suggestions = readTitleSuggestions(job);

  if (job.taskId === null) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.jobs.noTargetTask}
        />
      </EmptyHint>
    );
  }
  if (suggestions.length === 0) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.jobs.noTitleSuggestions}
        />
      </EmptyHint>
    );
  }

  const taskId = TaskId(job.taskId);
  const apply = (title: string) => {
    updateTask.mutate({ taskId, body: { title } });
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Title suggestions</SectionLabel>
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.title}
          className="flex items-start justify-between gap-3 rounded-[var(--radius-xs)] border border-hair p-2"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] text-ink">{suggestion.title}</div>
            <div className="text-[12px] text-ink-muted">{suggestion.rationale}</div>
          </div>
          <Button
            onClick={() => apply(suggestion.title)}
            disabled={updateTask.isPending}
          >
            Apply
          </Button>
        </div>
      ))}
    </section>
  );
}

function TaskCleanupActions({ job }: JobResultActionsProps) {
  const guidance = useGuidance();
  const { data, isPending } = useTaskCleanupSuggestionsQuery("all");
  const accept = useAcceptCleanupSuggestionMutation();
  const dismiss = useDismissCleanupSuggestionMutation();

  if (isPending) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.jobs.loadingCleanupSuggestions}
        />
      </EmptyHint>
    );
  }

  const suggestions = (data?.suggestions ?? []).filter((s) => s.jobId === job.id);
  if (suggestions.length === 0) {
    return (
      <EmptyHint>
        <GuidanceText
          locale={guidance.locale}
          message={guidance.messages.jobs.noCleanupSuggestions}
        />
      </EmptyHint>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Cleanup suggestions</SectionLabel>
      {suggestions.map((suggestion) => (
        <CleanupSuggestionRow
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={() => accept.mutate(suggestion.id)}
          onDismiss={() => dismiss.mutate(suggestion.id)}
          busy={accept.isPending || dismiss.isPending}
        />
      ))}
    </section>
  );
}

const PENDING_SUGGESTION_STATUS = "pending";

function CleanupSuggestionRow({
  suggestion,
  onAccept,
  onDismiss,
  busy,
}: {
  readonly suggestion: CleanupSuggestion;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
  readonly busy: boolean;
}) {
  const resolved = suggestion.status !== PENDING_SUGGESTION_STATUS;
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-xs)] border border-hair p-2">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ink">{suggestion.taskId}</div>
        <div className="text-[12px] text-ink-muted">{suggestion.rationale}</div>
      </div>
      {resolved ? (
        <span className="shrink-0 text-[12px] text-ink-muted">{suggestion.status}</span>
      ) : (
        <div className="flex shrink-0 gap-1">
          <Button onClick={onAccept} disabled={busy}>
            Archive
          </Button>
          <Button onClick={onDismiss} disabled={busy}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultLink({
  summary,
  to,
  label,
}: {
  readonly summary: string | null;
  readonly to: string;
  readonly label: string;
}) {
  return (
    <section className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink">{summary ?? "No result"}</span>
      <Link className="text-[12.5px] text-[var(--primary-hover)] underline" to={to}>
        {label}
      </Link>
    </section>
  );
}
