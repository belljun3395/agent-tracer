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
      <span
        aria-hidden
        style={{ width: 1, height: 18, background: "var(--hair)" }}
      />
      <ThemeToggle />
    </div>
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
        <ShieldIcon />
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

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z" />
    </svg>
  );
}
