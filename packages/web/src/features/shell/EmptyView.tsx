import type { ReactNode } from "react";

interface EmptyViewProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  /**
   * Optional recovery affordance (e.g., "Back to tasks" link in a 404
   * empty state). Rendered under the description.
   */
  readonly action?: ReactNode;
}

/**
 * Full-bleed empty state. Used by routes that don't have a focused task
 * (e.g., `/tasks` with nothing selected) and as a fallback in panels that
 * need a soft "no data yet" message.
 */
export function EmptyView({
  eyebrow,
  title,
  description,
  action,
}: EmptyViewProps) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="max-w-[440px] px-6">
        {eyebrow && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--ink-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="mt-3"
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.4px",
            color: "var(--ink)",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-2"
            style={{
              color: "var(--ink-subtle)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
