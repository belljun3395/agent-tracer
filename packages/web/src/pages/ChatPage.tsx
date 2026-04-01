import type React from "react";
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ChatWindow } from "../components/chat/index.js";
import { useCliChat } from "../hooks/useCliChat.js";
import type { CliType } from "../types/chat.js";

function toCliType(value: string | null): CliType {
  return value === "opencode" ? "opencode" : "claude";
}

export function ChatPage(): React.JSX.Element {
  const {
    state,
    activeSession,
    createSession,
    sendMessage,
    cancelSession,
    closeSession,
    setActiveSession
  } = useCliChat();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const open = searchParams.get("open");
    if (open !== "1") return;

    const cli = toCliType(searchParams.get("cli"));
    const workdir = searchParams.get("workdir") ?? "";
    const taskId = searchParams.get("taskId") ?? undefined;
    const cliSessionId = searchParams.get("sessionId") ?? undefined;

    if (!workdir.trim()) return;

    const sessionId = createSession({ cli, workdir, ...(taskId ? { taskId } : {}), ...(cliSessionId ? { cliSessionId } : {}) });
    setActiveSession(sessionId);

    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [createSession, searchParams, setActiveSession, setSearchParams]);

  const sessions = useMemo(() => Array.from(state.sessions.values()), [state.sessions]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex items-center gap-2">
          <span className="text-[0.9rem] font-semibold text-[var(--text-1)]">CLI Chat</span>
          <span className="text-[0.75rem] text-[var(--text-3)]">{state.isConnected ? "Connected" : "Reconnecting…"}</span>
        </div>
        <Link className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--text-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]" to="/">
          Back to Dashboard
        </Link>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] gap-0">
        <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--text-3)]">Sessions</div>
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-[0.78rem] text-[var(--text-2)] transition hover:border-[var(--accent)]"
                onClick={() => setActiveSession(session.id)}
                type="button"
              >
                <div className="font-semibold text-[var(--text-1)]">{session.cli === "claude" ? "Claude" : "OpenCode"}</div>
                <div className="truncate text-[0.7rem] text-[var(--text-3)]" title={session.workdir}>{session.workdir}</div>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-[var(--border)] px-3 py-2 text-[0.75rem] text-[var(--text-3)]">
                No sessions yet. Use "New Chat" in dashboard.
              </div>
            )}
          </div>
        </aside>

        <section className="min-h-0 p-3">
          <ChatWindow
            isConnected={state.isConnected}
            onCancel={() => {
              if (!activeSession) return;
              cancelSession(activeSession.id);
            }}
            onClose={() => {
              if (!activeSession) return;
              closeSession(activeSession.id);
            }}
            onSendMessage={(message) => {
              if (!activeSession) return;
              sendMessage(activeSession.id, message);
            }}
            session={activeSession}
          />
        </section>
      </main>
    </div>
  );
}
