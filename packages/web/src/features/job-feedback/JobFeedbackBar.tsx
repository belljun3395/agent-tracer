import { useState } from "react";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useSubmitJobFeedbackMutation } from "~web/entities/job/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import {
  JOB_FEEDBACK_SUBJECT_LABEL,
  type JobFeedbackSubject,
} from "~web/features/job-feedback/job-feedback.js";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

type Sentiment = typeof JOB_FEEDBACK_KIND.accept | typeof JOB_FEEDBACK_KIND.reject;

interface JobFeedbackBarProps {
  readonly jobId: string;
  readonly subject?: JobFeedbackSubject;
  readonly className?: string;
}

/** 에이전트 잡 결과에 대한 평가와 메모를 제출한다. */
export function JobFeedbackBar({ jobId, subject = "result", className }: JobFeedbackBarProps) {
  const guidance = useGuidance();
  const feedback = guidance.messages.jobs.feedback;
  const subjectCopy = feedback[subject];
  const mutation = useSubmitJobFeedbackMutation();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ sentiment: Sentiment | null; rating: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = mutation.isPending;

  const savedSentiment = saved?.sentiment ?? null;
  const savedRating = saved?.rating ?? null;
  // 이미 저장한 것과 다른 새 선택이 있을 때만 저장을 연다.
  const pendingSentiment = sentiment !== null && sentiment !== savedSentiment;
  const pendingRating = rating !== null && rating !== savedRating;
  const canSubmit = (pendingSentiment || pendingRating) && !disabled;
  const hasSaved = saved !== null && (savedSentiment !== null || savedRating !== null);

  function toggleSentiment(kind: Sentiment) {
    setError(null);
    setSentiment((prev) => (prev === kind ? null : kind));
  }

  function toggleRating(value: number) {
    setError(null);
    setRating((prev) => (prev === value ? null : value));
  }

  async function save() {
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [];
      if (pendingSentiment) {
        tasks.push(mutation.mutateAsync({ jobId, kind: sentiment }));
      }
      if (pendingRating) {
        tasks.push(mutation.mutateAsync({ jobId, kind: JOB_FEEDBACK_KIND.rating, ratingValue: rating }));
      }
      await Promise.all(tasks);
      setSaved({ sentiment, rating });
    } catch (err: unknown) {
      setError(readErrorMessage(err));
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-2 rounded-sm border border-hair bg-s1 px-3 py-2.5", className)}
      aria-label={`${JOB_FEEDBACK_SUBJECT_LABEL[subject]} feedback`}
    >
      <div className="flex flex-col gap-0.5">
        <GuidanceText
          as="p"
          className="m-0 text-[12px] font-medium text-ink"
          locale={guidance.locale}
          message={subjectCopy.prompt}
        />
        <GuidanceText
          as="p"
          className="m-0 text-[10.5px] leading-[1.45] text-ink-tertiary"
          locale={guidance.locale}
          message={subjectCopy.detail}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={sentiment === JOB_FEEDBACK_KIND.accept}
          onClick={() => toggleSentiment(JOB_FEEDBACK_KIND.accept)}
          className={buttonClassName(disabled, sentiment === JOB_FEEDBACK_KIND.accept, "primary")}
        >
          Useful
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={sentiment === JOB_FEEDBACK_KIND.reject}
          onClick={() => toggleSentiment(JOB_FEEDBACK_KIND.reject)}
          className={buttonClassName(disabled, sentiment === JOB_FEEDBACK_KIND.reject, "neutral")}
        >
          Not useful
        </button>
        <span aria-hidden className="text-hair-strong">·</span>
        <span className="text-ink-tertiary">Quality</span>
        <span className="inline-flex gap-1">
          {RATING_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-label={`Rating ${value} of 5`}
              aria-pressed={rating === value}
              onClick={() => toggleRating(value)}
              className={buttonClassName(disabled, rating === value, "neutral")}
            >
              {value}
            </button>
          ))}
        </span>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void save()}
          className={cn(
            "ml-auto min-h-7 rounded-xs border px-2.5 py-1 leading-none font-medium",
            canSubmit
              ? "border-primary bg-primary text-canvas cursor-pointer"
              : "border-hair text-ink-tertiary bg-transparent cursor-not-allowed",
          )}
        >
          Save
        </button>
      </div>

      <p aria-live="polite" className="m-0 min-h-[14px] text-[11px]">
        {error !== null ? (
          <span className="text-err [overflow-wrap:anywhere]">{error}</span>
        ) : canSubmit ? (
          <GuidanceText
            className="text-ink-tertiary"
            locale={guidance.locale}
            message={feedback.readyToSave}
          />
        ) : hasSaved ? (
          <GuidanceText
            className="text-primary"
            locale={guidance.locale}
            message={feedback.saved}
          />
        ) : (
          <GuidanceText
            className="text-ink-tertiary"
            locale={guidance.locale}
            message={feedback.saveHint}
          />
        )}
      </p>
    </div>
  );
}

function buttonClassName(disabled: boolean, selected: boolean, tone: "primary" | "neutral"): string {
  return cn(
    "min-h-7 rounded-xs border px-2 py-1 leading-none font-medium",
    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
    selected
      ? "border-primary bg-primary text-canvas"
      : tone === "primary"
        ? "border-primary text-primary bg-transparent"
        : "border-hair text-ink-subtle bg-transparent",
  );
}

function readErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
