import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import {
  evidenceToneClasses,
  type EvidenceTone,
} from "~web/widgets/rules/evidence/evidence-tone.js";

const VERDICT_LABEL: Record<VerdictStatus, string> = {
  verified: "FULFILLED",
  contradicted: "NOT FULFILLED",
  unverifiable: "CANNOT VERIFY",
};

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
  const tone = verdictTone(status);
  const toneClasses = evidenceToneClasses(tone);

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
      <FlowStep label="ACTION" count={actionCount} tone={tone} />
      <span
        className={cn(
          "text-[9.5px] uppercase tracking-[0.05em] py-px px-1.5 rounded-xs",
          status === null ? "text-ink-tertiary bg-s2" : toneClasses.strong,
          status === "verified" && "bg-s2",
          tone === "warn" && status !== null && "bg-warn/12",
        )}
      >
        {status === null ? "NOT EVALUATED" : VERDICT_LABEL[status]}
      </span>
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

function verdictTone(status: VerdictStatus | null): EvidenceTone {
  if (status === "verified") return "action";
  if (status === "contradicted" || status === "unverifiable") return "warn";
  return "trigger";
}
