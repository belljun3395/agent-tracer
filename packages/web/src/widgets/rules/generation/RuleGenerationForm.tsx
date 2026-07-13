import { RULE_GENERATION_INTENT_MAX_LENGTH } from "@monitor/kernel";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import type { RuleGenerationController } from "~web/widgets/rules/generation/useRuleGeneration.js";

const ANCHOR_PREVIEW_MAX = 70;

interface RuleGenerationFormProps {
  readonly controller: RuleGenerationController;
}

/** 규칙 생성의 근거 입력과 의도 입력을 표시한다. */
export function RuleGenerationForm({ controller }: RuleGenerationFormProps) {
  const guidance = useGuidance();
  const {
    anchorEventId,
    disabled,
    generate,
    intentDraft,
    isInFlight,
    setAnchorEventId,
    setIntentDraft,
    userInputs,
  } = controller;

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
          Auto-generate
        </p>
        <GuidanceText
          as="p"
          className="mt-1 mb-0 text-xs text-ink-muted leading-[1.4]"
          locale={guidance.locale}
          message={guidance.messages.rules.generation.introduction}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
          Rule source · user input
        </span>
        <select
          value={anchorEventId}
          onChange={(event) => setAnchorEventId(event.target.value)}
          disabled={disabled || userInputs.length === 0}
          aria-label="User input to base the rules on"
          className={cn(
            "w-full py-1.5 px-2 text-xs rounded-xs border border-hair bg-canvas text-ink",
            (disabled || userInputs.length === 0) && "cursor-not-allowed opacity-60",
          )}
        >
          {userInputs.map((input, index) => (
            <option key={input.eventId} value={input.eventId}>
              {`#${index + 1} · ${truncateInput(input.text)}`}
            </option>
          ))}
          <option value="">Whole task (no single input)</option>
        </select>
        <GuidanceText
          className="text-[10px] text-ink-subtle"
          locale={guidance.locale}
          message={guidance.messages.rules.generation.anchorHelp}
        />
      </label>
      <textarea
        value={intentDraft}
        onChange={(event) => setIntentDraft(event.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={RULE_GENERATION_INTENT_MAX_LENGTH}
        aria-label="Rule generation intent"
        className={cn(
          "w-full resize-y py-1.5 px-2 text-xs leading-[1.5] rounded-xs border border-hair bg-canvas text-ink placeholder:text-ink-subtle",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <GuidanceText
            className="text-[10px] text-ink-subtle"
            locale={guidance.locale}
            message={guidance.messages.rules.generation.intentHelp}
          />
          {intentDraft.length > 0 && (
            <span className="font-mono text-[10px] text-ink-subtle">
              {intentDraft.length}/{RULE_GENERATION_INTENT_MAX_LENGTH}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={disabled}
          className={cn(
            "py-1.5 px-2.5 text-xs font-medium border border-hair rounded-xs whitespace-nowrap",
            disabled
              ? "text-ink-tertiary bg-s2 cursor-not-allowed"
              : "text-canvas bg-ink cursor-pointer",
          )}
        >
          {isInFlight ? "Generating…" : "Generate rules"}
        </button>
      </div>
    </div>
  );
}

function truncateInput(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > ANCHOR_PREVIEW_MAX
    ? `${singleLine.slice(0, ANCHOR_PREVIEW_MAX)}…`
    : singleLine;
}
