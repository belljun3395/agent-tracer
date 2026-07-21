import type { LiveToolActivity } from "~web/features/chat-send/useChatTurn.js";
import { Pill } from "~web/shared/ui/index.js";

interface ChatToolCallChipProps {
  readonly activity: LiveToolActivity;
}

/** 진행 중인 턴에서 모델이 부른 도구 하나이며, 결과를 아직 못 받았으면 pulse한다. */
export function ChatToolCallChip({ activity }: ChatToolCallChipProps) {
  const pending = activity.result === null;
  return (
    <Pill tone={pending ? "warn" : "ok"} dot pulse={pending}>
      {activity.call.name}
    </Pill>
  );
}
