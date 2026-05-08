import { getMonitorWsUrl } from "~io/api.js";

/**
 * Footer below the scrollable task list — shows the websocket host so the
 * user can confirm where the dashboard is connected. Connection status
 * itself is shown by the topbar's WsLivePill, so this stays purely
 * informational.
 */
export function TaskListFooter() {
  const host = safeHost(getMonitorWsUrl());

  return (
    <div
      className="flex items-center gap-2 border-t border-[var(--hair)] px-3.5 py-2"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--ink-tertiary)",
      }}
    >
      WS {host}
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
