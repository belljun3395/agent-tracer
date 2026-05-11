interface TaskGroupHeaderProps {
  readonly label: string;
  readonly count: number;
}

/**
 * Sentence-case band label + plain count — separates Live/Today/Yesterday/
 * Older bands inside the scrollable task list. Sticks to the top of the
 * scroll container so the user keeps band context while scrolling through
 * a long history.
 *
 * Visual style is deliberately *unlike* the FilterPill row above it
 * (uppercase mono pills) so the eye reads "section divider" instead of
 * "another interactive filter".
 */
export function TaskGroupHeader({ label, count }: TaskGroupHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 flex items-baseline gap-2 px-3 pt-3 pb-1"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "-0.05px",
        color: "var(--ink-muted)",
        // Opaque background so rows scrolling under the header don't
        // bleed through the translucent canvas color.
        background: "var(--canvas)",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 400,
          color: "var(--ink-tertiary)",
          letterSpacing: 0,
        }}
      >
        {count}
      </span>
    </div>
  );
}
