import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import {
  evidenceToneClasses,
  type EvidenceTone,
} from "~web/widgets/rules/evidence/evidence-tone.js";
import {
  RuleVerdictChip,
  verdictTone,
} from "~web/widgets/rules/presentation/RuleVerdictChip.js";

interface EvidenceFlowProps {
  readonly status: VerdictStatus | null;
  readonly anchored: boolean;
  readonly triggerCount: number;
  readonly actionCount: number;
}

/** 규칙의 근거 입력과 기대 행동을 서버 판정 결과에 연결해 표시한다. */
export function EvidenceFlow({
  status,
  anchored,
  triggerCount,
  actionCount,
}: EvidenceFlowProps) {
  return (
    <div
      role="group"
      aria-label="Rule evidence flow"
      className="flex items-center gap-2 font-mono text-[10px]"
    >
      <FlowStep
        label={anchored ? "INPUT" : "TRIGGER"}
        count={triggerCount}
        tone="trigger"
      />
      <span aria-hidden className="text-[11px] text-ink-tertiary">
        →
      </span>
      <FlowStep label="ACTION" count={actionCount} tone={verdictTone(status)} />
      <RuleVerdictChip status={status} />
    </div>
  );
}

function FlowStep({
  label,
  count,
  tone,
}: {
  readonly label: string;
  readonly count: number;
  readonly tone: EvidenceTone;
}) {
  const toneClasses = evidenceToneClasses(tone);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cn("uppercase", toneClasses.text)}>{label}</span>
      <span className={cn("text-[12px] font-semibold", toneClasses.strong)}>
        {count}
      </span>
    </span>
  );
}

