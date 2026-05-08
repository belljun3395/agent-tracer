import type { TimelineEventRecord } from "~domain/monitoring.js";
import { splitBodySegments } from "~features/inspector/lib/event-body.js";

interface EventBodySectionProps {
  readonly event: TimelineEventRecord;
}

/**
 * Renders `event.body` with awareness of fenced code blocks. Plain text
 * paragraphs use sans-serif body; code blocks render in a mono panel with
 * the agent's payload preserved verbatim (whitespace, punctuation).
 */
export function EventBodySection({ event }: EventBodySectionProps) {
  if (!event.body) return null;
  const segments = splitBodySegments(event.body);
  if (segments.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {segments.map((segment, idx) =>
        segment.kind === "code" ? (
          <pre
            key={idx}
            className="rounded-[var(--radius-sm)] m-0 px-3 py-2 overflow-x-auto"
            style={{
              background: "var(--canvas)",
              border: "1px solid var(--hair)",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--ink)",
              lineHeight: 1.55,
              whiteSpace: "pre",
            }}
          >
            {segment.lang && (
              <div
                style={{
                  fontSize: 9.5,
                  color: "var(--ink-tertiary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {segment.lang}
              </div>
            )}
            {segment.text}
          </pre>
        ) : (
          <p
            key={idx}
            className="m-0"
            style={{
              fontSize: 12.5,
              color: "var(--ink-muted)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {segment.text}
          </p>
        ),
      )}
    </div>
  );
}
