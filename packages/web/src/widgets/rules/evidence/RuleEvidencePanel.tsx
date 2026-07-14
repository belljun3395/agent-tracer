import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import type { RuleEvidenceEvent } from "~web/entities/rule/model/rule-evidence.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import { useGuidance, useSetSelectedEventId } from "~web/shared/store/index.js";
import { GuidanceText } from "~web/shared/ui/index.js";
import { EvidenceEventSection } from "~web/widgets/rules/evidence/EvidenceEventSection.js";
import { EvidenceFlow } from "~web/widgets/rules/evidence/EvidenceFlow.js";

interface RuleEvidencePanelProps {
  readonly isLoading: boolean;
  readonly isError: boolean;
  /** 규칙이 이행됐는지. */
  readonly status: VerdictStatus | null;
  /** 근거가 된 사용자 입력이 있는 규칙인지. */
  readonly anchored: boolean;
  readonly triggers: readonly RuleEvidenceEvent[];
  readonly expects: readonly RuleEvidenceEvent[];
}

const WRAP_CLASS = "mt-2.5 pt-2.5 border-t border-dashed border-hair";

export function RuleEvidencePanel({
  isLoading,
  isError,
  status,
  anchored,
  triggers,
  expects,
}: RuleEvidencePanelProps) {
  const guidance = useGuidance();
  const setSelectedEventId = useSetSelectedEventId();
  const files = expects.filter((e) => e.filePath);
  const actions = expects.filter((e) => !e.filePath);
  const unfulfilled = triggers.filter((t) => t.unfulfilled);

  if (isLoading) {
    return (
      <GuidanceText
        as="div"
        className={cn(WRAP_CLASS, "text-[11px] text-ink-tertiary")}
        locale={guidance.locale}
        message={guidance.messages.rules.evidence.loading}
      />
    );
  }
  if (isError) {
    return (
      <GuidanceText
        as="div"
        className={cn(WRAP_CLASS, "text-[11px] text-err")}
        locale={guidance.locale}
        message={guidance.messages.rules.evidence.unavailable}
      />
    );
  }
  if (triggers.length === 0 && expects.length === 0) {
    return (
      <GuidanceText
        as="div"
        className={cn(WRAP_CLASS, "text-[11px] text-ink-tertiary")}
        locale={guidance.locale}
        message={guidance.messages.rules.evidence.empty}
      />
    );
  }

  const notFulfilled = status === "unmet" || status === "open";

  return (
    <div className={cn(WRAP_CLASS, "flex flex-col gap-2.5")}>
      <EvidenceFlow
        status={status}
        anchored={anchored}
        triggerCount={triggers.length}
        actionCount={expects.length}
      />
      {(notFulfilled || unfulfilled.length > 0) && (
        <div className="text-[11px] text-warn py-1 px-2 border border-dashed border-warn rounded-xs flex gap-1.5 items-center">
          <span>⚠</span>
          <GuidanceText
            locale={guidance.locale}
            message={guidance.messages.rules.evidence.unfulfilled}
          />
        </div>
      )}
      {triggers.length > 0 && (
        <EvidenceEventSection
          label={anchored ? "SOURCE INPUT" : "TRIGGER EVENTS"}
          tone="trigger"
          count={triggers.length}
          events={triggers}
          onJump={setSelectedEventId}
        />
      )}
      {files.length > 0 && (
        <EvidenceEventSection
          label="FILE ACTIONS"
          tone="action"
          count={files.length}
          events={files}
          onJump={setSelectedEventId}
        />
      )}
      {actions.length > 0 && (
        <EvidenceEventSection
          label="ACTION EVENTS"
          tone="action"
          count={actions.length}
          events={actions}
          onJump={setSelectedEventId}
        />
      )}
    </div>
  );
}
