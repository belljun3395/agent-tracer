import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          404
        </div>
        <h1 className="mt-2" style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
          Page not found
        </h1>
        <Link
          to="/tasks"
          className="mt-3 inline-block"
          style={{ color: "var(--primary-hover)", fontSize: 13, borderBottom: "1px dotted var(--primary)" }}
        >
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
