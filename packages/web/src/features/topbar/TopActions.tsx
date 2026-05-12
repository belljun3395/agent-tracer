import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip } from "~ui/index.js";
import { useRulesQuery } from "~state/server/queries.js";
import { ThemeToggle } from "./ThemeToggle.js";

/**
 * Right-side action area. The Rules button doubles as both a counter
 * (showing how many rules are configured workspace-wide) and a link to
 * the `/rules` management page. Avatar awaits a real user session.
 */
export function TopActions() {
  return (
    <div className="flex items-center gap-2">
      <RulesButton />
      <SettingsButton />
      <span
        aria-hidden
        style={{ width: 1, height: 18, background: "var(--hair)" }}
      />
      <ThemeToggle />
    </div>
  );
}

function SettingsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === "/settings";
  return (
    <Tooltip content="Settings" side="bottom">
      <button
        type="button"
        onClick={() => void navigate("/settings")}
        aria-label="Settings"
        aria-current={active ? "page" : undefined}
        className="h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--s1)] transition-colors"
        style={{
          color: active ? "var(--ink)" : "var(--ink-muted)",
          background: active ? "var(--s1)" : "transparent",
        }}
      >
        <GearIcon />
      </button>
    </Tooltip>
  );
}

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function RulesButton() {
  const { data, isLoading } = useRulesQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const count = data?.rules.length ?? 0;
  const active = location.pathname === "/rules";

  const onClick = () => {
    void navigate("/rules");
  };

  return (
    <Tooltip content="Manage rules" side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label="Manage rules"
        aria-current={active ? "page" : undefined}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--s1)] transition-colors"
        style={{
          color: active ? "var(--ink)" : "var(--ink-muted)",
          background: active ? "var(--s1)" : "transparent",
        }}
      >
        <ChecklistIcon />
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "-0.05px" }}>
          Rules
        </span>
        <span
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            padding: "0 6px",
            minWidth: 20,
            background: count > 0 ? "var(--ink-tertiary)" : "var(--s1)",
            color: count > 0 ? "#fff" : "var(--ink-tertiary)",
            lineHeight: "16px",
          }}
        >
          {isLoading ? "…" : count}
        </span>
      </button>
    </Tooltip>
  );
}

/**
 * Two short lines with check marks — reads as "a list of checks" which
 * is what the rules surface enforces. The previous shield outline
 * looked like a security badge with no obvious connection to
 * "configurable behaviour rules".
 */
function ChecklistIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 7 5 9 9 5" />
      <polyline points="3 17 5 19 9 15" />
      <line x1="13" y1="7" x2="21" y2="7" />
      <line x1="13" y1="17" x2="21" y2="17" />
    </svg>
  );
}
