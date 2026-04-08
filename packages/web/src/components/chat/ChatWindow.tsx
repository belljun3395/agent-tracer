/**
 * @module components/chat/ChatWindow
 *
 * 채팅 창 메인 컨테이너.
 * 헤더, 메시지 목록, 입력 필드를 조합한 완전한 채팅 UI.
 */

import type React from "react";

import type { ChatSession, ChatSessionStatus, CliType } from "../../types/chat.js";
import { cn } from "../../lib/ui/cn.js";
import { Button } from "../ui/Button.js";
import { MessageList } from "./MessageList.js";
import { MessageInput } from "./MessageInput.js";

interface ChatWindowProps {
  /** 현재 세션 */
  readonly session: ChatSession | null;
  /** WebSocket 연결 상태 */
  readonly isConnected: boolean;
  /** Guard 상태로 인해 입력이 막혔을 때의 이유 */
  readonly disabledReason?: string | null;
  /** 메시지 전송 핸들러 */
  readonly onSendMessage: (message: string) => void;
  /** 세션 취소 핸들러 */
  readonly onCancel: () => void;
  /** 창 닫기 핸들러 */
  readonly onClose: () => void;
}

/** 세션 상태별 표시 텍스트 */
const STATUS_LABELS: Record<ChatSessionStatus, string> = {
  idle: "Idle",
  starting: "Starting…",
  running: "Running",
  stopping: "Stopping…",
  error: "Error"
};

/** CLI 타입별 표시 이름 */
const CLI_LABELS: Record<CliType, string> = {
  claude: "Claude Code",
  opencode: "OpenCode"
};

/** 상태별 색상 클래스 */
function getStatusColor(status: ChatSessionStatus): string {
  switch (status) {
    case "running":
      return "bg-[var(--ok)] text-white";
    case "starting":
    case "stopping":
      return "bg-[var(--warn)] text-white";
    case "error":
      return "bg-[var(--err)] text-white";
    default:
      return "bg-[var(--text-3)] text-white";
  }
}

export function ChatWindow({
  session,
  isConnected,
  disabledReason,
  onSendMessage,
  onCancel,
  onClose
}: ChatWindowProps): React.JSX.Element {
  const canSend = session !== null
    && (session.status === "idle" || session.status === "running")
    && isConnected
    && !disabledReason;
  const canCancel = session !== null && (session.status === "running" || session.status === "starting");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-4">
        <div className="flex items-center gap-3">
          {/* CLI badge */}
          {session && (
            <span className="rounded-[6px] bg-[var(--accent-light)] px-2 py-0.5 text-[0.72rem] font-semibold text-[var(--accent)]">
              {CLI_LABELS[session.cli]}
            </span>
          )}

          {/* Status indicator */}
          {session && (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold",
              getStatusColor(session.status)
            )}>
              {(session.status === "running" || session.status === "starting") && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-80" />
              )}
              {STATUS_LABELS[session.status]}
            </span>
          )}

          {/* Workdir */}
          {session && (
            <span className="max-w-[200px] truncate text-[0.75rem] text-[var(--text-3)]" title={session.workdir}>
              {session.workdir}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <span className={cn(
            "flex items-center gap-1.5 text-[0.72rem] font-medium",
            isConnected ? "text-[var(--ok)]" : "text-[var(--warn)]"
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              isConnected ? "bg-[var(--ok)]" : "bg-[var(--warn)] animate-pulse"
            )} />
            {isConnected ? "Connected" : "Reconnecting"}
          </span>

          {/* Cancel button */}
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close chat"
          >
            ✕
          </Button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        {session ? (
          <MessageList messages={session.messages} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[0.875rem] text-[var(--text-3)]">
              No active session. Start a new chat or continue an existing one.
            </p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-2)] p-3">
        <MessageInput
          disabled={!canSend}
          placeholder={
            !session
              ? "No session active"
              : disabledReason
                ? disabledReason
              : !isConnected
                ? "Reconnecting…"
                : session.status !== "running"
                  ? `Session ${session.status}…`
                  : "Type a message…"
          }
          onSend={onSendMessage}
        />
      </div>
    </div>
  );
}
