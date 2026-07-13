import { AI_AGENT_BACKEND, type AiAgentBackend } from "~web/entities/job/model/job.js";
import { Select } from "~web/shared/ui/index.js";
import { cn } from "~web/shared/ui/lib/cn.js";

export type AgentBackendChoice = AiAgentBackend | "";

const OPTIONS: ReadonlyArray<{ readonly value: AgentBackendChoice; readonly label: string }> = [
  { value: "", label: "Worker default" },
  { value: AI_AGENT_BACKEND.python, label: "Python LangGraph" },
  { value: AI_AGENT_BACKEND.claudeSdk, label: "Claude SDK" },
];

interface AgentBackendSelectProps {
  readonly value: AgentBackendChoice;
  readonly onChange: (value: AgentBackendChoice) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

/** 에이전트 잡 실행기가 사용할 백엔드를 선택한다. */
export function AgentBackendSelect({
  value,
  onChange,
  disabled = false,
  className,
}: AgentBackendSelectProps) {
  return (
    <Select
      aria-label="Agent backend"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as AgentBackendChoice)}
      className={cn("text-xs", className)}
    >
      {OPTIONS.map((option) => (
        <option key={option.value || "default"} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function selectedAgentBackend(value: AgentBackendChoice): AiAgentBackend | undefined {
  return value === "" ? undefined : value;
}
