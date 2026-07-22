import type { LiveToolActivity } from "~web/features/chat-send/useChatTurn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Pill } from "~web/shared/ui/index.js";

interface ChatToolCallChipProps {
  readonly activity: LiveToolActivity;
}

/** 진행 중인 턴에서 모델이 부른 도구 하나이며, 결과를 아직 못 받았으면 "실행 중"으로 pulse하고 결과가 오면 완료 표시로 바꾼다. */
export function ChatToolCallChip({ activity }: ChatToolCallChipProps) {
  const guidance = useGuidance();
  const pending = activity.result === null;
  return (
    <Pill tone={pending ? "warn" : "ok"} dot pulse={pending}>
      {activity.call.name}
      {pending ? (
        <GuidanceText
          as="span"
          className="text-[var(--ink-tertiary)]"
          locale={guidance.locale}
          message={guidance.messages.chat.toolRunning}
        />
      ) : (
        <span aria-hidden>✓</span>
      )}
    </Pill>
  );
}
