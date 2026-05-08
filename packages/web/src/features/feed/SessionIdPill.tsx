import { useState } from "react";
import { Tooltip } from "~ui/index.js";

interface SessionIdPillProps {
  readonly sessionId: string;
}

/**
 * Click-to-copy pill that surfaces the runtime session id. Operators
 * paste it into their terminal as `claude --resume <id>` (or the codex
 * equivalent) to pick up where the agent left off — that's the entire
 * reason this label exists in v6's inspector.
 *
 * Truncated to last 8 chars for the visible label so the topbar stays
 * tidy; the full id is what gets copied to the clipboard.
 */
export function SessionIdPill({ sessionId }: SessionIdPillProps) {
  const [copied, setCopied] = useState(false);
  const short = sessionId.slice(-8);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or insecure context — silently no-op.
      // Operators can still copy by selecting from the Inspector KV grid.
    }
  };

  return (
    <Tooltip
      content={copied ? "Copied · use claude --resume <id>" : `Copy ${sessionId}`}
      side="bottom"
    >
      <button
        type="button"
        onClick={() => void onClick()}
        aria-label={`Copy session id ${sessionId}`}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-[2px]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: copied ? "var(--ok)" : "var(--ink-subtle)",
          border: `1px solid ${copied ? "var(--ok)" : "var(--hair)"}`,
          background: "transparent",
          letterSpacing: 0,
          transition: "color 150ms, border-color 150ms",
        }}
      >
        <span style={{ color: "var(--ink-tertiary)" }}>session</span>
        <span>{short}</span>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </Tooltip>
  );
}

function CopyIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
