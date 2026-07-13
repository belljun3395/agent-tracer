import { useState } from "react";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useSubmitJobFeedbackMutation } from "~web/entities/job/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";

type Sentiment = typeof JOB_FEEDBACK_KIND.accept | typeof JOB_FEEDBACK_KIND.reject;

interface RuleFeedbackButtonsProps {
  /** 이 규칙을 만든 생성 잡 id. 피드백은 이 잡에 규칙 id를 달아 기록된다. */
  readonly jobId: string;
  readonly ruleId: string;
}

/** 생성된 개별 규칙의 품질 평가. */
export function RuleFeedbackButtons({ jobId, ruleId }: RuleFeedbackButtonsProps) {
  const guidance = useGuidance();
  const mutation = useSubmitJobFeedbackMutation();
  const [pick, setPick] = useState<Sentiment | null>(null);
  const [saved, setSaved] = useState<Sentiment | null>(null);
  const [failed, setFailed] = useState(false);
  const disabled = mutation.isPending;
  const dirty = pick !== null && pick !== saved;

  function toggle(kind: Sentiment) {
    setFailed(false);
    setPick((prev) => (prev === kind ? null : kind));
  }

  async function save() {
    if (!dirty) return;
    setFailed(false);
    try {
      await mutation.mutateAsync({ jobId, targetId: ruleId, kind: pick });
      setSaved(pick);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-tertiary">
      <GuidanceText
        locale={guidance.locale}
        message={guidance.messages.rules.feedback.prompt}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Mark rule as useful"
        aria-pressed={pick === JOB_FEEDBACK_KIND.accept}
        onClick={() => toggle(JOB_FEEDBACK_KIND.accept)}
        className={chipClassName(disabled, pick === JOB_FEEDBACK_KIND.accept)}
      >
        Useful
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="Mark rule as not useful"
        aria-pressed={pick === JOB_FEEDBACK_KIND.reject}
        onClick={() => toggle(JOB_FEEDBACK_KIND.reject)}
        className={chipClassName(disabled, pick === JOB_FEEDBACK_KIND.reject)}
      >
        Not useful
      </button>
      {dirty && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void save()}
          className="rounded-xs border border-primary bg-primary px-1.5 py-0.5 leading-none font-medium text-canvas cursor-pointer"
        >
          Save
        </button>
      )}
      {failed && (
        <GuidanceText
          className="text-err"
          locale={guidance.locale}
          message={guidance.messages.rules.feedback.saveFailed}
        />
      )}
      {!dirty && saved !== null && (
        <GuidanceText
          className="text-primary"
          locale={guidance.locale}
          message={guidance.messages.rules.feedback.saved}
        />
      )}
    </div>
  );
}

function chipClassName(disabled: boolean, selected: boolean): string {
  return cn(
    "rounded-xs border px-1.5 py-0.5 leading-none font-medium",
    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
    selected
      ? "border-primary bg-primary text-canvas"
      : "border-hair text-ink-subtle bg-transparent",
  );
}
