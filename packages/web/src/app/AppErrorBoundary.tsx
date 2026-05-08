import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Top-level safety net. Without this, a render error anywhere in the
 * tree (a malformed event payload tripping a parser, a stale ref the
 * graph layout doesn't expect, …) replaces the whole dashboard with
 * the browser's default white screen — no recovery affordance, no way
 * to even reach the sidebar to switch tasks.
 *
 * The fallback intentionally provides:
 *
 *   - the error class + message (technical, but the dashboard's user
 *     is the operator running the agent — they can read it)
 *   - a "Reload dashboard" button that does a hard reload, which
 *     also wipes the error state without us needing to expose a
 *     "reset boundary" handle
 *   - a hint to copy the message into a bug report
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to whatever the host environment uses for monitoring;
    // for now console.error is the only sink.
    console.error("AppErrorBoundary caught:", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--canvas, #010102)",
          color: "var(--ink, #f7f8f8)",
          fontFamily: "var(--font-sans, system-ui)",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            padding: "20px 22px",
            background: "var(--s1, #0d0d12)",
            border: "1px solid var(--hair, rgba(255,255,255,0.08))",
            borderRadius: 8,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontFamily: "var(--font-mono, ui-monospace)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--err, #ff6b6b)",
            }}
          >
            Dashboard crashed
          </p>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.2px",
            }}
          >
            {error.name}: {error.message}
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-subtle, rgba(255,255,255,0.6))",
            }}
          >
            Reloading recovers in most cases. If this is reproducible, copy the
            message above into a bug report — the operator's URL plus the message
            is usually enough to diagnose.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--canvas, #010102)",
              background: "var(--primary, #5e6ad2)",
              border: "1px solid var(--primary, #5e6ad2)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reload dashboard
          </button>
        </div>
      </div>
    );
  }
}
