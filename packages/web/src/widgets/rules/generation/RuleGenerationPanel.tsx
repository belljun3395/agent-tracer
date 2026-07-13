import type { TaskId } from "~web/shared/identity.js";
import { RuleGenerationForm } from "~web/widgets/rules/generation/RuleGenerationForm.js";
import { RuleGenerationRunStatus } from "~web/widgets/rules/generation/RuleGenerationRunStatus.js";
import { useRuleGeneration } from "~web/widgets/rules/generation/useRuleGeneration.js";

interface RuleGenerationPanelProps {
  readonly taskId: TaskId;
  readonly taskStatus: string | null;
}

/** 규칙 생성 입력과 실행 상태의 공개 조립점이다. */
export function RuleGenerationPanel({ taskId, taskStatus }: RuleGenerationPanelProps) {
  const controller = useRuleGeneration(taskId, taskStatus);
  return (
    <div className="border border-dashed border-hair rounded-sm p-3 bg-s1">
      <RuleGenerationForm controller={controller} />
      <RuleGenerationRunStatus controller={controller} />
    </div>
  );
}
