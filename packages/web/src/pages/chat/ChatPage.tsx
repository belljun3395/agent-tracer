import { useNavigate, useParams } from "react-router-dom";
import { ChatThreadId } from "~web/shared/identity.js";
import { useChatMessagesQuery, useChatThreadsQuery } from "~web/entities/chat/api/queries.js";
import { useChatTurn } from "~web/features/chat-send/useChatTurn.js";
import {
  AgentBackendSelect,
  selectedAgentBackend,
  type AgentBackendChoice,
} from "~web/features/agent-backend-select/AgentBackendSelect.js";
import { useState } from "react";
import { useGuidance } from "~web/shared/store/index.js";
import { EmptyView, GuidanceText } from "~web/shared/ui/index.js";
import { ChatComposer } from "~web/widgets/chat/ChatComposer.js";
import { ChatMessageStream } from "~web/widgets/chat/ChatMessageStream.js";
import { ChatThreadRail } from "~web/widgets/chat/ChatThreadRail.js";
import { ChatThreadTitleEditor } from "~web/widgets/chat/ChatThreadTitleEditor.js";

/** `/chat`은 빈 상태이고, `/chat/:threadId`는 URL이 가리키는 스레드의 대화를 SSE로 흘려보는 화면이다. */
export function ChatPage() {
  const guidance = useGuidance();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId?: string }>();
  const selectedThreadId = routeThreadId ? ChatThreadId(routeThreadId) : null;
  const [backendChoice, setBackendChoice] = useState<AgentBackendChoice>("");

  const threadsQuery = useChatThreadsQuery();
  const messagesQuery = useChatMessagesQuery(selectedThreadId);
  const turn = useChatTurn(selectedThreadId);

  const openThread = (threadId: ChatThreadId) => {
    void navigate(`/chat/${threadId}`);
  };
  const handleDeleted = (threadId: ChatThreadId) => {
    if (threadId === selectedThreadId) void navigate("/chat");
  };

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
          onSelect={openThread}
          onCreated={openThread}
          onDeleted={handleDeleted}
        />

        <div className="flex-1 min-h-0 flex flex-col">
          {selectedThread ? (
            <>
              <div className="px-4 py-2.5 border-b border-hair flex items-center gap-2.5 shrink-0">
                <ChatThreadTitleEditor key={selectedThread.id} thread={selectedThread} />
                <AgentBackendSelect value={backendChoice} onChange={setBackendChoice} />
              </div>

              <ChatMessageStream
                threadId={selectedThread.id}
                messages={messagesQuery.data?.messages ?? []}
                turn={turn}
              />

              <ChatComposer
                isStreaming={turn.isStreaming}
                onSend={(content) => turn.sendMessage(content, selectedAgentBackend(backendChoice))}
                onStop={turn.stop}
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
