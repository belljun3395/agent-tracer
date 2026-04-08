import type React from "react";
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ChatWindow } from "../components/chat/index.js";
import { useCliChat } from "../hooks/useCliChat.js";
import type { CliType } from "../types/chat.js";

const RESUME_OPEN_CONSUMED_PREFIX = "agent-tracer.chat-open-consumed:";
const RESUME_OPEN_CONSUMED_TTL_MS = 10_000;

function toCliType(value: string | null): CliType {
  return value === "opencode" ? "opencode" : "claude";
}

function buildResumeOpenKey(searchParams: URLSearchParams): string {
  return JSON.stringify({
    cli: toCliType(searchParams.get("cli")),
    workdir: searchParams.get("workdir") ?? "",
    model: searchParams.get("model") ?? "",
    taskId: searchParams.get("taskId") ?? "",
    sessionId: searchParams.get("sessionId") ?? ""
  });
}

function hasConsumedResumeOpen(key: string): boolean {
  const storageKey = `${RESUME_OPEN_CONSUMED_PREFIX}${key}`;
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) {
    return false;
  }
  const consumedAt = Number.parseInt(raw, 10);
  if (!Number.isFinite(consumedAt)) {
    window.sessionStorage.removeItem(storageKey);
    return false;
  }
  if (Date.now() - consumedAt > RESUME_OPEN_CONSUMED_TTL_MS) {
    window.sessionStorage.removeItem(storageKey);
    return false;
  }
  return true;
}

function markResumeOpenConsumed(key: string): void {
  window.sessionStorage.setItem(`${RESUME_OPEN_CONSUMED_PREFIX}${key}`, String(Date.now()));
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

    const resumeOpenKey = buildResumeOpenKey(searchParams);
    if (hasConsumedResumeOpen(resumeOpenKey)) {
      return;
    }

    const cli = toCliType(searchParams.get("cli"));
    const workdir = searchParams.get("workdir") ?? "";
    const model = searchParams.get("model") ?? undefined;
    const taskId = searchParams.get("taskId") ?? undefined;
    const cliSessionId = searchParams.get("sessionId") ?? undefined;

    if (!workdir.trim()) return;

    const next = new URLSearchParams(searchParams);
    next.delete("open");
    const nextQuery = next.toString();
    markResumeOpenConsumed(resumeOpenKey);
    window.history.replaceState(
      window.history.state,
      "",
      nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
    );
    setSearchParams(next, { replace: true });

    const sessionId = createSession({
      cli,
      workdir,
      ...(model ? { model } : {}),
      ...(taskId ? { taskId } : {}),
      ...(cliSessionId ? { cliSessionId } : {})
    });
    setActiveSession(sessionId);
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
