import type { ChatThreadId } from "~web/shared/identity.js";
import type { ChatConfirmRequest } from "~web/entities/chat/model/chat-turn.js";
import { useConfirmToolMutation } from "~web/entities/chat/api/mutations.js";
import { useGuidance } from "~web/shared/store/index.js";
import { Button, Card, GuidanceText } from "~web/shared/ui/index.js";

interface ChatConfirmCardProps {
  readonly threadId: ChatThreadId;
  readonly request: ChatConfirmRequest;
  readonly onResolved: (confirmationId: string) => void;
}

/** 쓰기 도구가 실행 대신 세운 승인 요청 하나이며, 확인 엔드포인트로 결정을 보낸다. */
export function ChatConfirmCard({ threadId, request, onResolved }: ChatConfirmCardProps) {
  const guidance = useGuidance();
  const confirmMutation = useConfirmToolMutation(threadId);

  const decide = (decision: "approve" | "reject") => {
    confirmMutation.mutate(
      { confirmationId: request.id, decision },
      { onSuccess: () => onResolved(request.id) },
    );
  };

  return (
    <Card surface="canvas" className="self-center max-w-[85%]">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-warn">
        {request.toolName}
      </span>
      <p className="m-0 text-[12.5px] text-ink">{request.summary}</p>
      <GuidanceText
        as="p"
        className="m-0 text-[11px] text-ink-subtle"
        locale={guidance.locale}
        message={guidance.messages.chat.confirmDescription}
      />
      <div className="flex items-center gap-2 mt-1">
        <Button
          variant="primary"
          onClick={() => decide("approve")}
          disabled={confirmMutation.isPending}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          onClick={() => decide("reject")}
          disabled={confirmMutation.isPending}
        >
          Reject
        </Button>
      </div>
    </Card>
  );
}
