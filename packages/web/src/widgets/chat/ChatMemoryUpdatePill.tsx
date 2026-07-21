import type { ChatMemoryUpdate } from "~web/entities/chat/model/chat-turn.js";
import { useGuidance } from "~web/shared/store/index.js";
import { GuidanceText, Pill } from "~web/shared/ui/index.js";

interface ChatMemoryUpdatePillProps {
  readonly update: ChatMemoryUpdate;
}

/** remember_fact가 즉시 적재한 기억을 사용자에게 투명하게 보여 주는 작은 표시다. */
export function ChatMemoryUpdatePill({ update }: ChatMemoryUpdatePillProps) {
  const guidance = useGuidance();
  return (
    <div className="self-center flex items-center gap-2 max-w-[80%] text-[11px] text-ink-tertiary">
      <Pill tone="primary" dot>
        {update.key}
      </Pill>
      <GuidanceText locale={guidance.locale} message={guidance.messages.chat.memoryUpdated} />
    </div>
  );
}
