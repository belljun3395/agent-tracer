import { Link } from "react-router-dom";

/**
 * Left-most chrome of the topbar — square accent tile + product name,
 * wrapped in a Link so clicking either the tile or the wordmark routes
 * back to the task list. Without this the brand looked clickable but did
 * nothing, which was confusing when you were deep inside a task detail.
 * Width is tuned to roughly align with the 280px sidebar below.
 */
export function BrandMark() {
  return (
    <Link
      to="/tasks"
      aria-label="Go to task list"
      className="flex items-center gap-2.5 shrink-0"
      style={{ minWidth: 248, textDecoration: "none" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: "var(--radius-sm)",
          background: "var(--primary)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        A
      </div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          letterSpacing: "-0.2px",
          color: "var(--ink)",
        }}
      >
        Agent Tracer
      </div>
    </Link>
  );
}
