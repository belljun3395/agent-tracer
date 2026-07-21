import { useEffect, useState } from "react";
import type { ChatThreadId } from "~web/shared/identity.js";
import { useChatMessagesQuery, useChatThreadsQuery } from "~web/entities/chat/api/queries.js";
import { useChatTurn } from "~web/features/chat-send/useChatTurn.js";
import {
  AgentBackendSelect,
  selectedAgentBackend,
  type AgentBackendChoice,
} from "~web/features/agent-backend-select/AgentBackendSelect.js";
import { useGuidance } from "~web/shared/store/index.js";
import { EmptyView, GuidanceText } from "~web/shared/ui/index.js";
import { ChatComposer } from "~web/widgets/chat/ChatComposer.js";
import { ChatMessageStream } from "~web/widgets/chat/ChatMessageStream.js";
import { ChatThreadRail } from "~web/widgets/chat/ChatThreadRail.js";

/** `/chat`. 대화 스레드를 나열하고, 한 스레드의 대화를 SSE로 흘려보는 화면이다. */
export function ChatPage() {
  const guidance = useGuidance();
  const threadsQuery = useChatThreadsQuery();
  const [selectedThreadId, setSelectedThreadId] = useState<ChatThreadId | null>(null);
  const [backendChoice, setBackendChoice] = useState<AgentBackendChoice>("");

  useEffect(() => {
    if (selectedThreadId !== null) return;
    const first = threadsQuery.data?.threads[0];
    if (first) setSelectedThreadId(first.id);
  }, [threadsQuery.data, selectedThreadId]);

  const messagesQuery = useChatMessagesQuery(selectedThreadId);
  const turn = useChatTurn(selectedThreadId);

  const selectedThread =
    threadsQuery.data?.threads.find((thread) => thread.id === selectedThreadId) ?? null;

  return (
    <div className="flex flex-col min-h-0 h-full overflow-hidden">
      <header className="px-9 pt-6 pb-4 flex flex-col gap-1 border-b border-hair shrink-0">
        <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
          Workspace
        </p>
        <h1 className="mt-0.5 mb-0 text-[22px] font-semibold text-ink tracking-[-0.3px]">
          Chat
        </h1>
        <GuidanceText
          as="p"
          className="mt-1 mb-0 text-[12.5px] text-ink-subtle"
          locale={guidance.locale}
          message={guidance.messages.chat.workspaceIntroduction}
        />
        {threadsQuery.isError && (
          <GuidanceText
            as="p"
            className="mt-1 mb-0 text-[12.5px] text-err"
            locale={guidance.locale}
            message={guidance.messages.chat.loadError}
          />
        )}
      </header>

      <main className="flex-1 min-h-0 flex">
        <ChatThreadRail
          threads={threadsQuery.data?.threads ?? []}
          selectedThreadId={selectedThreadId}
          onSelect={setSelectedThreadId}
          onCreated={setSelectedThreadId}
        />

        <div className="flex-1 min-h-0 flex flex-col">
          {selectedThread ? (
            <>
              <div className="px-4 py-2.5 border-b border-hair flex items-center gap-2.5 shrink-0">
                <span className="text-[13px] font-medium text-ink flex-1 min-w-0 truncate">
                  {selectedThread.title}
                </span>
                <AgentBackendSelect value={backendChoice} onChange={setBackendChoice} />
              </div>

              <ChatMessageStream
                threadId={selectedThread.id}
                messages={messagesQuery.data?.messages ?? []}
                turn={turn}
              />

              <ChatComposer
                disabled={turn.isStreaming}
                onSend={(content) =>
                  turn.sendMessage(content, selectedAgentBackend(backendChoice))
                }
              />
            </>
          ) : (
            <EmptyView
              eyebrow="Chat"
              title="No conversation selected"
              description={guidance.messages.chat.selectThread}
              locale={guidance.locale}
            />
          )}
        </div>
      </main>
    </div>
  );
}
