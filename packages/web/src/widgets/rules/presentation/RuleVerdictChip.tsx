import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { cn } from "~web/shared/ui/lib/cn.js";
import {
  evidenceToneClasses,
  type EvidenceTone,
} from "~web/widgets/rules/evidence/evidence-tone.js";

const VERDICT_LABEL: Record<VerdictStatus, string> = {
  satisfied: "FULFILLED",
  unmet: "NOT FULFILLED",
  open: "NOT YET",
  unknown: "CANNOT VERIFY",
};

/** 판정이 열린 적 없는 규칙이며 이행 여부를 아직 말할 수 없다. */
const NOT_EVALUATED = "NOT EVALUATED";

export function verdictTone(status: VerdictStatus | null): EvidenceTone {
  if (status === "satisfied") return "action";
  if (status === null) return "trigger";
  return "warn";
}

export function verdictLabel(status: VerdictStatus | null): string {
  return status === null ? NOT_EVALUATED : VERDICT_LABEL[status];
}

/** 규칙이 이행됐는지를 한 줄로 답하며 접힌 카드와 증거 패널이 같은 것을 쓴다. */
export function RuleVerdictChip({ status }: { readonly status: VerdictStatus | null }) {
  const tone = verdictTone(status);
  const toneClasses = evidenceToneClasses(tone);
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.05em] py-px px-1.5 rounded-xs leading-4",
        status === null ? "text-ink-tertiary bg-s2" : toneClasses.strong,
        status === "satisfied" && "bg-s2",
        tone === "warn" && status !== null && "bg-warn/12",
      )}
    >
      {verdictLabel(status)}
    </span>
  );
}
