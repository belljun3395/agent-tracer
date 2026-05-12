import { getMonitorWsUrl } from "~io/api.js";
import { Tooltip } from "~ui/index.js";

interface TaskListFooterProps {
  /**
   * When every visible task shares the same `runtimeSource`, the panel
   * passes it down so we can show a single subtle caption (e.g.
   * "all claude-plugin") in the footer instead of crowding the filter row.
   */
  readonly runtimeCaption?: string;
}

/**
 * Footer below the scrollable task list — shows the websocket host so
 * the user can confirm where the dashboard is connected, plus a small
 * keyboard-shortcut help affordance. Connection status itself lives in
 * the topbar's WsLivePill.
 */
export function TaskListFooter({ runtimeCaption }: TaskListFooterProps) {
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
      <span>WS {host}</span>
      {runtimeCaption && (
        <span
          title={`Every task in this list is sourced from ${runtimeCaption}`}
        >
          · all {runtimeCaption}
        </span>
      )}
      <Tooltip
        content="Press ? anywhere for keyboard shortcuts (j/k navigate · / search · g rules · Esc clear)"
        side="top"
      >
        <button
          type="button"
          aria-label="Keyboard shortcuts (press ? key)"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "?", bubbles: true }),
            );
          }}
          className="ml-auto inline-flex items-center justify-center rounded-[var(--radius-xs)] h-4 w-4 hover:bg-[var(--s1)]"
          style={{
            border: "1px solid var(--hair)",
            color: "var(--ink-tertiary)",
            cursor: "help",
            fontSize: 9,
            lineHeight: 1,
          }}
        >
          ?
        </button>
      </Tooltip>
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
